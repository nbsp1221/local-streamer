import { InternalError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type EncryptThumbnailUseCaseDependencies,
  type EncryptThumbnailUseCaseRequest,
  type EncryptThumbnailUseCaseResponse,
} from './encrypt-thumbnail.types';

export class EncryptThumbnailUseCase extends UseCase<
  EncryptThumbnailUseCaseRequest,
  EncryptThumbnailUseCaseResponse
> {
  constructor(private readonly deps: EncryptThumbnailUseCaseDependencies) {
    super();
  }

  async execute(request: EncryptThumbnailUseCaseRequest): Promise<Result<EncryptThumbnailUseCaseResponse>> {
    try {
      // 1. Input validation
      const validation = this.validate(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Log the operation
      this.deps.logger?.info(`Starting thumbnail encryption for video: ${request.videoId}`);

      // 3. Encrypt the thumbnail using the service
      const encryptionResult = await this.deps.thumbnailEncryptionService.encryptThumbnail({
        videoId: request.videoId,
        thumbnailPath: request.thumbnailPath,
      });

      // 4. Calculate compression ratio for metrics
      const compressionRatio = encryptionResult.encryptedSize / encryptionResult.originalSize;

      // 5. Prepare response
      const response: EncryptThumbnailUseCaseResponse = {
        videoId: request.videoId,
        encryptedPath: encryptionResult.encryptedPath,
        originalSize: encryptionResult.originalSize,
        encryptedSize: encryptionResult.encryptedSize,
        compressionRatio,
      };

      this.deps.logger?.info(
        `✅ Thumbnail encryption completed for ${request.videoId}: ` +
        `${encryptionResult.originalSize}B → ${encryptionResult.encryptedSize}B ` +
        `(ratio: ${compressionRatio.toFixed(3)})`,
      );

      return Result.ok(response);
    }
    catch (error) {
      this.deps.logger?.error('Failed to encrypt thumbnail', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to encrypt thumbnail',
        ),
      );
    }
  }

  private validate(request: EncryptThumbnailUseCaseRequest): Result<void> {
    if (!request.videoId || !request.videoId.trim()) {
      return Result.fail(new ValidationError('Video ID is required'));
    }

    if (!request.thumbnailPath || !request.thumbnailPath.trim()) {
      return Result.fail(new ValidationError('Thumbnail path is required'));
    }

    // Validate UUID format for videoId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(request.videoId)) {
      return Result.fail(new ValidationError('Invalid video ID format'));
    }

    return Result.ok(undefined);
  }
}
