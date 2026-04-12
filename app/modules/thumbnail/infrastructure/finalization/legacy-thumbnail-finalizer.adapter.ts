import type { ThumbnailFinalizerInput, ThumbnailFinalizerPort } from '../../application/ports/thumbnail-finalizer.port';

interface LoggerLike {
  info(message: string, data?: unknown): void;
  error(message: string, error?: unknown): void;
}

interface LegacyThumbnailFinalizerAdapterDependencies {
  logger?: LoggerLike;
}

export class LegacyThumbnailFinalizerAdapter implements ThumbnailFinalizerPort {
  private readonly logger: LoggerLike;

  constructor(deps: LegacyThumbnailFinalizerAdapterDependencies = {}) {
    this.logger = deps.logger ?? console;
  }

  async finalizeThumbnail(input: ThumbnailFinalizerInput): Promise<void> {
    try {
      const { encryptedThumbnailGenerator } = await import('~/legacy/modules/thumbnail/shared/thumbnail-generator-encrypted.server');
      const result = await encryptedThumbnailGenerator.migrateExistingThumbnail(input.videoId);

      if (result.success) {
        this.logger.info(`✅ Thumbnail encrypted for: ${input.title} (${input.videoId})`);
        return;
      }

      this.logger.error(`❌ Failed to encrypt thumbnail for ${input.videoId}:`, result.error ?? 'Unknown thumbnail migration failure');
    }
    catch (error) {
      this.logger.error(`❌ Failed to encrypt thumbnail for ${input.videoId}:`, error);
    }
  }
}
