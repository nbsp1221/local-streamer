import path from 'path';
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

      // 2. Ensure videos directory exists
      await this.deps.fileManager.ensureVideosDirectory();

      // 3. Move file to library (it generates its own UUID)
      const videoId = await this.deps.fileManager.moveToLibrary(request.filename);

      // 4. Get video information
      const ext = path.extname(request.filename); // includes leading dot (e.g., ".mp4")
      const videoPath = path.join(config.paths.videos, videoId, `video${ext}`);
      const videoInfo = await this.deps.fileManager.getVideoInfo(videoPath);

      // 5. Handle thumbnail (move only, encryption happens after HLS)
      await this.handleThumbnail(request.filename, videoId, request.title);

      // 6. Create video entity
      const video = this.createVideoEntity({
        id: videoId,
        title: request.title,
        tags: request.tags,
        description: request.description,
        duration: videoInfo.duration,
      });

      // 7. Save to database
      await this.saveVideo(video);

      // 8. Generate HLS version
      const hlsResult = await this.generateHLS(videoId, videoPath, request.encodingOptions);

      // 9. Encrypt thumbnail after HLS generation (when AES key is available)
      // Always attempt encryption since thumbnails are generated during HLS conversion
      await this.encryptThumbnailAfterHLS(videoId, request.title);

      // 10. Return success response
      return Result.ok({
        videoId,
        message: hlsResult.success
          ? 'Video added to library successfully with video conversion'
          : 'Video added to library but video conversion failed',
        hlsEnabled: hlsResult.success,
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

  private async handleThumbnail(filename: string, videoId: string, title: string): Promise<boolean> {
    // Move temporary thumbnail if available (encryption happens later)
    const moved = await this.deps.fileManager.moveTempThumbnailToLibrary(filename, videoId);

    if (moved) {
      this.deps.logger?.info(`Temporary thumbnail moved for: ${title} (${videoId})`);
      return true;
    }
    else {
      this.deps.logger?.info(
        `No temporary thumbnail available for: ${title} (${videoId}). ` +
        `Encrypted thumbnail will be generated during video conversion if needed`,
      );
      return false;
    }
  }

  /**
   * Encrypt thumbnail after HLS generation when AES key is available
   */
  private async encryptThumbnailAfterHLS(videoId: string, title: string): Promise<void> {
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
    tags: string[];
    description?: string;
    duration: number;
  }): Video {
    return {
      id: props.id,
      title: props.title.trim(),
      tags: props.tags.filter(tag => tag.trim().length > 0).map(tag => tag.trim()),
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

  private async generateHLS(videoId: string, videoPath: string, encodingOptions?: EncodingOptions): Promise<Result<void>> {
    this.deps.logger?.info(`Starting video conversion for video: ${videoId}`);

    try {
      await this.deps.hlsConverter.convertVideo(videoId, videoPath, encodingOptions);
      this.deps.logger?.info(`Video conversion completed successfully for ${videoId}`);

      return Result.ok(undefined);
    }
    catch (error) {
      this.deps.logger?.error(`Video conversion failed for ${videoId}:`, error);

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return Result.fail(new InternalError(`Video conversion failed: ${errorMessage}`));
    }
  }
}
