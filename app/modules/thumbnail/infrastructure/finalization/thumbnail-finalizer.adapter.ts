import type { ThumbnailFinalizerInput, ThumbnailFinalizerPort } from '../../application/ports/thumbnail-finalizer.port';
import { ThumbnailEncryptionService } from '../encryption/thumbnail-encryption.service';
import { Pbkdf2ThumbnailKeyManager } from '../security/pbkdf2-thumbnail-key-manager';

interface LoggerLike {
  error(message: string, error?: unknown): void;
  info(message: string, data?: unknown): void;
}

interface ThumbnailFinalizerAdapterDependencies {
  logger?: LoggerLike;
}

export class ThumbnailFinalizerAdapter implements ThumbnailFinalizerPort {
  private readonly logger: LoggerLike;
  private readonly thumbnailEncryptionService: ThumbnailEncryptionService;

  constructor(deps: ThumbnailFinalizerAdapterDependencies = {}) {
    this.logger = deps.logger ?? console;
    this.thumbnailEncryptionService = new ThumbnailEncryptionService({
      keyManager: new Pbkdf2ThumbnailKeyManager(),
      logger: this.logger,
    });
  }

  async finalizeThumbnail(input: ThumbnailFinalizerInput): Promise<void> {
    try {
      const result = await this.thumbnailEncryptionService.migrateExistingThumbnail(input.videoId);

      if (result) {
        this.logger.info(`✅ Thumbnail encrypted for: ${input.title} (${input.videoId})`);
        return;
      }

      this.logger.error(
        `❌ Failed to encrypt thumbnail for ${input.videoId}:`,
        'Unknown thumbnail migration failure',
      );
    }
    catch (error) {
      this.logger.error(`❌ Failed to encrypt thumbnail for ${input.videoId}:`, error);
    }
  }
}
