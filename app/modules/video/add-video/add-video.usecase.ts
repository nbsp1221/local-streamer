import path from 'path';
import { UseCase } from '~/lib/usecase.base';
import { Result } from '~/lib/result';
import { ValidationError, InternalError } from '~/lib/errors';
import { type AddVideoRequest, type AddVideoResponse, type AddVideoDependencies } from './add-video.types';
import { type Video } from '~/types/video';
import { config } from '~/configs';

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

      // 5. Handle thumbnail
      await this.handleThumbnail(request.filename, videoId, request.title);

      // 6. Create video entity
      const video = this.createVideoEntity({
        id: videoId,
        title: request.title,
        tags: request.tags,
        description: request.description,
        duration: videoInfo.duration,
        format: videoInfo.format,
      });

      // 7. Save to database
      await this.saveVideo(video);

      // 8. Generate HLS version
      const hlsResult = await this.generateHLS(videoId, videoPath);

      // 9. Return success response
      return Result.ok({
        videoId,
        message: hlsResult.success 
          ? 'Video added to library successfully with HLS'
          : 'Video added to library but HLS generation failed',
        hlsEnabled: hlsResult.success,
      });
    }
    catch (error) {
      this.deps.logger?.error('Failed to add video to library', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to add video to library'
        )
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
    const moved = await this.deps.fileManager.moveTempThumbnailToLibrary(filename, videoId);

    if (!moved) {
      this.deps.logger?.info(
        `No temporary thumbnail available for: ${title} (${videoId}). ` +
        `Thumbnail will be generated during HLS conversion if needed`
      );
    }

    return moved;
  }

  private createVideoEntity(props: {
    id: string;
    title: string;
    tags: string[];
    description?: string;
    duration: number;
    format: any;
  }): Video {
    return {
      id: props.id,
      title: props.title.trim(),
      tags: props.tags.filter(tag => tag.trim().length > 0).map(tag => tag.trim()),
      thumbnailUrl: `/api/thumbnail/${props.id}`,
      videoUrl: `/data/videos/${props.id}/playlist.m3u8`, // HLS playlist
      duration: props.duration,
      format: props.format,
      addedAt: new Date(),
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
      format: video.format,
      description: video.description,
    });

    this.deps.logger?.info(`Video added to library: ${video.title} (${video.id})`);
  }

  private async generateHLS(videoId: string, videoPath: string): Promise<Result<void>> {
    this.deps.logger?.info(`Starting HLS generation for video: ${videoId}`);

    try {
      await this.deps.hlsConverter.convertVideo(videoId, videoPath);
      this.deps.logger?.info(`HLS generated successfully for ${videoId}`);

      // Update database with HLS status
      await this.deps.videoRepository.updateHLSStatus(videoId, true, new Date());
      this.deps.logger?.info(`Database updated with HLS status for ${videoId}`);

      return Result.ok(undefined);
    }
    catch (error) {
      this.deps.logger?.error(`HLS generation failed for ${videoId}:`, error);

      // Update database to mark HLS as failed/unavailable
      try {
        await this.deps.videoRepository.updateHLSStatus(videoId, false);
      }
      catch (dbError) {
        this.deps.logger?.error(`Failed to update database HLS status for ${videoId}:`, dbError);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return Result.fail(new InternalError(`HLS generation failed: ${errorMessage}`));
    }
  }
}
