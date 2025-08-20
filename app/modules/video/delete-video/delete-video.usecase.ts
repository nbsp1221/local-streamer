import { InternalError, NotFoundError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type DeleteVideoDependencies,
  type DeleteVideoRequest,
  type DeleteVideoResponse,
} from './delete-video.types';

export class DeleteVideoUseCase extends UseCase<DeleteVideoRequest, DeleteVideoResponse> {
  constructor(private readonly deps: DeleteVideoDependencies) {
    super();
  }

  async execute(request: DeleteVideoRequest): Promise<Result<DeleteVideoResponse>> {
    try {
      // 1. Validate input
      const validation = this.validateInput(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Check if video exists
      const video = await this.deps.videoRepository.findById(request.videoId);
      if (!video) {
        return Result.fail(new NotFoundError('Video'));
      }

      // 3. Delete from database first (safer transaction order)
      await this.deps.videoRepository.delete(request.videoId);
      this.deps.logger?.info(`Video metadata deleted: ${video.title} (${request.videoId})`);

      // 4. Delete physical files
      try {
        await this.deps.fileManager.deleteVideoFiles(request.videoId);
        this.deps.logger?.info(`Video files deleted: ${request.videoId}`);
      }
      catch (fileError) {
        // Log file deletion failure but don't fail the operation
        // Database is already consistent, file cleanup can be done manually
        this.deps.logger?.error(
          `Failed to delete video files for ${request.videoId}, manual cleanup needed`,
          fileError,
        );
      }

      return Result.ok({
        videoId: request.videoId,
        title: video.title,
        message: 'Video deleted successfully',
      });
    }
    catch (error) {
      this.deps.logger?.error('Failed to delete video', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to delete video',
        ),
      );
    }
  }

  private validateInput(request: DeleteVideoRequest): Result<void> {
    if (!request.videoId || typeof request.videoId !== 'string' || request.videoId.trim().length === 0) {
      return Result.fail(new ValidationError('Video ID must be a non-empty string'));
    }

    return Result.ok(undefined);
  }
}
