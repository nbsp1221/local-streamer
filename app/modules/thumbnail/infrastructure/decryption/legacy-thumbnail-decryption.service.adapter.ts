import { DecryptThumbnailUseCase } from '~/legacy/modules/thumbnail/decrypt-thumbnail/decrypt-thumbnail.usecase';
import { ThumbnailEncryptionService } from '~/legacy/modules/thumbnail/shared/thumbnail-encryption.service';
import { Pbkdf2KeyManagerAdapter } from '~/legacy/modules/video/security/adapters/pbkdf2-key-manager.adapter';
import type {
  ThumbnailDecryptionInput,
  ThumbnailDecryptionResult,
  ThumbnailDecryptionServicePort,
} from '../../application/ports/thumbnail-decryption-service.port';

interface LegacyThumbnailDecryptionServiceAdapterDependencies {
  logger?: Console;
}

export class LegacyThumbnailDecryptionServiceAdapter implements ThumbnailDecryptionServicePort {
  private readonly decryptThumbnailUseCase: DecryptThumbnailUseCase;

  constructor(deps: LegacyThumbnailDecryptionServiceAdapterDependencies = {}) {
    const keyManager = new Pbkdf2KeyManagerAdapter();
    const thumbnailEncryptionService = new ThumbnailEncryptionService({
      keyManager,
      logger: deps.logger ?? console,
    });

    this.decryptThumbnailUseCase = new DecryptThumbnailUseCase({
      logger: deps.logger ?? console,
      thumbnailEncryptionService,
    });
  }

  async decryptThumbnail(input: ThumbnailDecryptionInput): Promise<ThumbnailDecryptionResult> {
    const result = await this.decryptThumbnailUseCase.execute(input);

    if (!result.success) {
      return {
        error: result.error,
        success: false,
      };
    }

    return {
      data: result.data,
      success: true,
    };
  }
}
