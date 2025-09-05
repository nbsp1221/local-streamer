import { join } from 'path';
import { config } from '~/configs';
import { Pbkdf2KeyManagerAdapter } from '~/modules/video/security/adapters/pbkdf2-key-manager.adapter';
import type { ThumbnailGenerationPort } from '../application/ports/thumbnail-generation.port';
import { EncryptThumbnailUseCase } from '../encrypt-thumbnail/encrypt-thumbnail.usecase';
import { FFmpegThumbnailAdapter } from '../infrastructure/adapters/ffmpeg-thumbnail.adapter';
import { ThumbnailEncryptionService } from './thumbnail-encryption.service';
import { ENCRYPTED_THUMBNAIL_EXTENSION } from './thumbnail-encryption.types';

export interface EncryptedThumbnailOptions {
  videoId: string;
  inputPath: string;
  timestamp?: number;
  useSmart?: boolean;
}

export interface EncryptedThumbnailResult {
  success: boolean;
  encryptedPath?: string;
  originalSize?: number;
  encryptedSize?: number;
  error?: string;
}

/**
 * Enhanced thumbnail generator that creates and immediately encrypts thumbnails
 * This replaces the existing thumbnail generation workflow for new videos
 */
export class EncryptedThumbnailGenerator {
  private keyManager: Pbkdf2KeyManagerAdapter;
  private thumbnailEncryptionService: ThumbnailEncryptionService;
  private encryptThumbnailUseCase: EncryptThumbnailUseCase;
  private thumbnailGenerator: ThumbnailGenerationPort;

  constructor() {
    this.keyManager = new Pbkdf2KeyManagerAdapter();
    this.thumbnailEncryptionService = new ThumbnailEncryptionService({
      keyManager: this.keyManager,
      logger: console,
    });
    this.encryptThumbnailUseCase = new EncryptThumbnailUseCase({
      thumbnailEncryptionService: this.thumbnailEncryptionService,
      logger: console,
    });
    this.thumbnailGenerator = new FFmpegThumbnailAdapter();
  }

  /**
   * Generate and encrypt thumbnail for a video
   * Combines thumbnail generation + encryption in a single operation
   */
  async generateEncryptedThumbnail(options: EncryptedThumbnailOptions): Promise<EncryptedThumbnailResult> {
    const { videoId, inputPath, timestamp = 3, useSmart = true } = options;

    try {
      console.log(`🔒 Starting encrypted thumbnail generation for video: ${videoId}`);

      // 1. Ensure the video has an AES key (should exist from video encryption)
      const hasKey = await this.keyManager.keyExists(videoId);
      if (!hasKey) {
        return {
          success: false,
          error: `No AES key found for video: ${videoId}. Video must be processed first.`,
        };
      }

      // 2. Generate temporary plaintext thumbnail
      const tempThumbnailPath = join(config.paths.videos, videoId, 'thumbnail_temp.jpg');

      const thumbnailResult = await this.thumbnailGenerator.generateThumbnail({
        videoId,
        inputPath,
        outputPath: tempThumbnailPath,
        timestamp,
        useSmartScan: useSmart,
      });

      if (!thumbnailResult.success) {
        return {
          success: false,
          error: `Thumbnail generation failed: ${thumbnailResult.error.message}`,
        };
      }

      console.log(`📸 Plaintext thumbnail generated, now encrypting...`);

      // 3. Encrypt the thumbnail using the UseCase
      const encryptionResult = await this.encryptThumbnailUseCase.execute({
        videoId,
        thumbnailPath: tempThumbnailPath,
      });

      if (!encryptionResult.success) {
        return {
          success: false,
          error: `Thumbnail encryption failed: ${encryptionResult.error.message}`,
        };
      }

      const { encryptedPath, originalSize, encryptedSize } = encryptionResult.data;

      console.log(`✅ Encrypted thumbnail created: ${videoId}`);
      console.log(`   Size: ${originalSize}B → ${encryptedSize}B`);
      console.log(`   Path: ${encryptedPath}`);

      return {
        success: true,
        encryptedPath,
        originalSize,
        encryptedSize,
      };
    }
    catch (error) {
      console.error(`❌ Failed to generate encrypted thumbnail for ${videoId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during thumbnail encryption',
      };
    }
  }

  /**
   * Migrate existing plaintext thumbnail to encrypted format
   * Used for upgrading existing videos to encrypted thumbnails
   */
  async migrateExistingThumbnail(videoId: string): Promise<EncryptedThumbnailResult> {
    try {
      console.log(`🔄 Migrating existing thumbnail for video: ${videoId}`);

      const migrationResult = await this.thumbnailEncryptionService.migrateExistingThumbnail(videoId);

      if (!migrationResult) {
        return {
          success: false,
          error: 'Migration failed or no plaintext thumbnail found',
        };
      }

      console.log(`✅ Thumbnail migration completed for video: ${videoId}`);

      return {
        success: true,
        encryptedPath: join(config.paths.videos, videoId, `thumbnail${ENCRYPTED_THUMBNAIL_EXTENSION}`),
      };
    }
    catch (error) {
      console.error(`❌ Failed to migrate thumbnail for ${videoId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during thumbnail migration',
      };
    }
  }
}

// Export singleton instance
export const encryptedThumbnailGenerator = new EncryptedThumbnailGenerator();
