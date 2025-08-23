import { InternalError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type DecryptThumbnailUseCaseDependencies,
  type DecryptThumbnailUseCaseRequest,
  type DecryptThumbnailUseCaseResponse,
} from './decrypt-thumbnail.types';

export class DecryptThumbnailUseCase extends UseCase<
  DecryptThumbnailUseCaseRequest,
  DecryptThumbnailUseCaseResponse
> {
  constructor(private readonly deps: DecryptThumbnailUseCaseDependencies) {
    super();
  }

  async execute(request: DecryptThumbnailUseCaseRequest): Promise<Result<DecryptThumbnailUseCaseResponse>> {
    try {
      // 1. Input validation
      const validation = this.validate(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Log the operation
      this.deps.logger?.info(`Starting thumbnail decryption for video: ${request.videoId}`);

      // 3. Check if encrypted thumbnail exists
      const hasEncryptedThumbnail = await this.deps.thumbnailEncryptionService.hasEncryptedThumbnail(
        request.videoId,
      );

      if (!hasEncryptedThumbnail) {
        this.deps.logger?.warn(`No encrypted thumbnail found for video: ${request.videoId}`);
        return Result.fail(
          new ValidationError(`Encrypted thumbnail not found for video: ${request.videoId}`),
        );
      }

      // 4. Decrypt the thumbnail using the service
      const decryptionResult = await this.deps.thumbnailEncryptionService.decryptThumbnail({
        videoId: request.videoId,
        validateAccess: request.validateAccess,
      });

      // 5. Prepare response
      const response: DecryptThumbnailUseCaseResponse = {
        imageBuffer: decryptionResult.imageBuffer,
        mimeType: decryptionResult.mimeType,
        size: decryptionResult.size,
        videoId: request.videoId,
      };

      this.deps.logger?.info(
        `✅ Thumbnail decryption completed for ${request.videoId}: ${decryptionResult.size}B`,
      );

      return Result.ok(response);
    }
    catch (error) {
      this.deps.logger?.error('Failed to decrypt thumbnail', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to decrypt thumbnail',
        ),
      );
    }
  }

  private validate(request: DecryptThumbnailUseCaseRequest): Result<void> {
    if (!request.videoId || !request.videoId.trim()) {
      return Result.fail(new ValidationError('Video ID is required'));
    }

    // Validate UUID format for videoId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(request.videoId)) {
      return Result.fail(new ValidationError('Invalid video ID format'));
    }

    return Result.ok(undefined);
  }
}
