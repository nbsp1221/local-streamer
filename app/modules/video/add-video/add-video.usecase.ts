import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '~/configs';
import { InternalError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import { type Video } from '~/types/video';
import {
  type AddVideoDependencies,
  type AddVideoRequest,
  type AddVideoResponse,
  type EncodingOptions,
} from './add-video.types';

export class AddVideoUseCase extends UseCase<AddVideoRequest, AddVideoResponse> {
  constructor(private readonly deps: AddVideoDependencies) {
    super();
  }

  async execute(request: AddVideoRequest): Promise<Result<AddVideoResponse>> {
    try {
      // 1. Validate input
      const validation = this.validate(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Generate UUID for video
      const videoId = uuidv4();

      // 3. Create workspace for the video
      const workspace = await this.deps.workspaceManager.createWorkspace({
        videoId,
        temporary: false,
        cleanupOnError: true,
      });

      // 4. Move file from uploads to workspace
      const sourcePath = path.join(config.paths.uploads, request.filename);
      const ext = path.extname(request.filename);
      const targetName = `video${ext}`;

      const moveResult = await this.deps.workspaceManager.moveToWorkspace(
        sourcePath,
        workspace,
        targetName,
      );

      if (!moveResult.success) {
        throw new Error(`Failed to move file to workspace: ${moveResult.error}`);
      }

      // 5. Get video information using analysis service
      const videoAnalysis = await this.deps.videoAnalysis.analyze(moveResult.destination);
      const videoInfo = {
        size: videoAnalysis.fileSize,
        duration: videoAnalysis.duration,
        mimeType: this.getMimeType(ext),
      };

      // 6. Handle thumbnail (move only, encryption happens after DASH)
      await this.handleThumbnail(request.filename, videoId, request.title, workspace);

      // 7. Create video entity
      const video = this.createVideoEntity({
        id: videoId,
        title: request.title,
        tags: request.tags,
        description: request.description,
        duration: videoInfo.duration,
      });

      // 7. Save to database
      await this.saveVideo(video);

      // 8. Generate video processing (DASH)
      const transcodeResult = await this.processVideo(videoId, moveResult.destination, request.encodingOptions);

      // 9. Encrypt thumbnail after DASH generation (when AES key is available)
      // Always attempt encryption since thumbnails are generated during DASH conversion
      await this.encryptThumbnailAfterDASH(videoId, request.title);

      // 10. Return success response
      return Result.ok({
        videoId,
        message: transcodeResult.success
          ? 'Video added to library successfully with video conversion'
          : 'Video added to library but video conversion failed',
        dashEnabled: transcodeResult.success,
      });
    }
    catch (error) {
      this.deps.logger?.error('Failed to add video to library', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to add video to library',
        ),
      );
    }
  }

  private validate(request: AddVideoRequest): Result<void> {
    if (!request.filename || !request.title) {
      return Result.fail(new ValidationError('Filename and title are required'));
    }

    if (request.title.trim().length === 0) {
      return Result.fail(new ValidationError('Title cannot be empty'));
    }

    return Result.ok(undefined);
  }

  private async handleThumbnail(filename: string, videoId: string, title: string, workspace: any): Promise<boolean> {
    // Move temporary thumbnail if available (encryption happens later)
    const nameWithoutExt = path.parse(filename).name;
    const tempThumbnailPath = path.join(config.paths.thumbnails, `${nameWithoutExt}.jpg`);

    try {
      // Check if temp thumbnail exists
      await import('fs').then(fs => fs.promises.access(tempThumbnailPath));

      // Move temp thumbnail to workspace
      const moveResult = await this.deps.workspaceManager.moveToWorkspace(
        tempThumbnailPath,
        workspace,
        'thumbnail.jpg',
      );

      if (moveResult.success) {
        this.deps.logger?.info(`Temporary thumbnail moved for: ${title} (${videoId})`);
        return true;
      }
      else {
        this.deps.logger?.error(`Failed to move thumbnail: ${moveResult.error}`);
        return false;
      }
    }
    catch {
      this.deps.logger?.info(
        `No temporary thumbnail available for: ${title} (${videoId}). ` +
        `Encrypted thumbnail will be generated during DASH conversion if needed`,
      );
      return false;
    }
  }

  /**
   * Encrypt thumbnail after DASH generation when AES key is available
   */
  private async encryptThumbnailAfterDASH(videoId: string, title: string): Promise<void> {
    try {
      // Lazy load to avoid environment variable issues during testing
      const { encryptedThumbnailGenerator } = await import('~/modules/thumbnail/shared/thumbnail-generator-encrypted.server');
      const encryptionResult = await encryptedThumbnailGenerator.migrateExistingThumbnail(videoId);

      if (encryptionResult.success) {
        this.deps.logger?.info(`✅ Thumbnail encrypted for: ${title} (${videoId})`);
      }
      else {
        this.deps.logger?.error(`❌ Failed to encrypt thumbnail for ${videoId}: ${encryptionResult.error}`);
      }
    }
    catch (error) {
      this.deps.logger?.error(`❌ Failed to encrypt thumbnail for ${videoId}:`, error);
    }
  }

  private createVideoEntity(props: {
    id: string;
    title: string;
    tags?: string[];
    description?: string;
    duration: number;
  }): Video {
    return {
      id: props.id,
      title: props.title.trim(),
      tags: (props.tags || []).filter(tag => tag.trim().length > 0).map(tag => tag.trim()),
      thumbnailUrl: `/api/thumbnail/${props.id}`,
      videoUrl: `/videos/${props.id}/manifest.mpd`, // DASH manifest
      duration: props.duration,
      createdAt: new Date(),
      description: props.description?.trim(),
    };
  }

  private async saveVideo(video: Video): Promise<void> {
    await this.deps.videoRepository.create({
      id: video.id,
      title: video.title,
      tags: video.tags,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      duration: video.duration,
      description: video.description,
    });

    this.deps.logger?.info(`Video added to library: ${video.title} (${video.id})`);
  }

  private async processVideo(videoId: string, videoPath: string, encodingOptions?: EncodingOptions): Promise<Result<void>> {
    this.deps.logger?.info(`Starting video processing for video: ${videoId}`);

    try {
      // Map encoding options to business quality levels
      const { quality, useGpu } = this.mapEncodingOptionsToQuality(encodingOptions);

      // Use VideoTranscoder with business-focused API
      const transcodeResult = await this.deps.videoTranscoder.transcode({
        videoId,
        sourcePath: videoPath,
        quality,
        useGpu,
      });

      if (transcodeResult.success) {
        this.deps.logger?.info(`Video processing completed successfully for ${videoId}`);
        return Result.ok(undefined);
      }
      else {
        this.deps.logger?.error(`Video processing failed for ${videoId}:`, transcodeResult.error);
        return Result.fail(transcodeResult.error);
      }
    }
    catch (error) {
      this.deps.logger?.error(`Video processing failed for ${videoId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return Result.fail(new InternalError(`Video processing failed: ${errorMessage}`));
    }
  }

  /**
   * Maps technical encoding options to business quality levels.
   * This preserves backwards compatibility during Phase 2.
   */
  private mapEncodingOptionsToQuality(encodingOptions?: EncodingOptions): { quality: 'high' | 'medium' | 'fast'; useGpu: boolean } {
    // Default to high quality for backwards compatibility
    if (!encodingOptions) {
      return { quality: 'high', useGpu: false };
    }

    // Map encoder types to business quality (Phase 2: simple mapping)
    const useGpu = encodingOptions.encoder === 'gpu-h265';

    // For Phase 2, all current encoding options map to 'high' quality
    // This maintains current behavior while introducing the new interface
    return { quality: 'high', useGpu };
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(ext: string): string {
    const mimeTypes: Record<string, string> = {
      '.mp4': 'video/mp4',
      '.avi': 'video/x-msvideo',
      '.mkv': 'video/x-matroska',
      '.mov': 'video/quicktime',
      '.webm': 'video/webm',
      '.m4v': 'video/mp4',
      '.flv': 'video/x-flv',
      '.wmv': 'video/x-ms-wmv',
    };
    return mimeTypes[ext.toLowerCase()] || 'video/mp4';
  }
}
