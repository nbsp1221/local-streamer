import { InternalError, NotFoundError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type UpdateVideoDependencies,
  type UpdateVideoRequest,
  type UpdateVideoResponse,
} from './update-video.types';

export class UpdateVideoUseCase extends UseCase<UpdateVideoRequest, UpdateVideoResponse> {
  constructor(private readonly deps: UpdateVideoDependencies) {
    super();
  }

  async execute(request: UpdateVideoRequest): Promise<Result<UpdateVideoResponse>> {
    try {
      // 1. Validate input
      const validation = this.validateInput(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Check if video exists
      const existingVideo = await this.deps.videoRepository.findById(request.videoId);
      if (!existingVideo) {
        return Result.fail(new NotFoundError('Video'));
      }

      // 3. Prepare and sanitize updates
      const updates = this.prepareUpdates(request);

      // 4. Update video
      const updatedVideo = await this.deps.videoRepository.update(request.videoId, updates);

      if (!updatedVideo) {
        return Result.fail(new InternalError('Failed to update video'));
      }

      this.deps.logger?.info(`Video updated: ${updatedVideo.title} (${request.videoId})`);

      return Result.ok({
        video: updatedVideo,
        message: `Video "${updatedVideo.title}" updated successfully`,
      });
    }
    catch (error) {
      this.deps.logger?.error('Failed to update video', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to update video',
        ),
      );
    }
  }

  private validateInput(request: UpdateVideoRequest): Result<void> {
    // Validate video ID
    if (!request.videoId || typeof request.videoId !== 'string' || request.videoId.trim().length === 0) {
      return Result.fail(new ValidationError('Video ID must be a non-empty string'));
    }

    // Validate title
    if (!request.title || typeof request.title !== 'string' || request.title.trim().length === 0) {
      return Result.fail(new ValidationError('Title is required and must be a non-empty string'));
    }

    // Validate tags if provided
    if (request.tags !== undefined && !Array.isArray(request.tags)) {
      return Result.fail(new ValidationError('Tags must be an array'));
    }

    // Validate description if provided
    if (request.description !== undefined && typeof request.description !== 'string') {
      return Result.fail(new ValidationError('Description must be a string'));
    }

    return Result.ok(undefined);
  }

  private prepareUpdates(request: UpdateVideoRequest) {
    return {
      title: request.title.trim(),
      tags: this.sanitizeTags(request.tags),
      description: this.sanitizeDescription(request.description),
    };
  }

  private sanitizeTags(tags?: string[]): string[] {
    if (!Array.isArray(tags)) {
      return [];
    }

    return tags
      .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
      .map(tag => tag.trim());
  }

  private sanitizeDescription(description?: string): string | undefined {
    if (typeof description !== 'string') {
      return undefined;
    }

    const trimmed = description.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
}
