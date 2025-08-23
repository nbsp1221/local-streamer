import { promises as fs } from 'fs';
import { join } from 'path';
import type { AESKeyManager } from '~/services/aes-key-manager.server';
import { config } from '~/configs';
import { ThumbnailCryptoUtils } from './thumbnail-crypto.utils';
import {
  type DecryptThumbnailRequest,
  type DecryptThumbnailResponse,
  type EncryptThumbnailRequest,
  type EncryptThumbnailResponse,
  ENCRYPTED_THUMBNAIL_EXTENSION,
} from './thumbnail-encryption.types';

export interface ThumbnailEncryptionServiceDependencies {
  aesKeyManager: AESKeyManager;
  logger?: Console;
}

/**
 * Service for handling thumbnail encryption and decryption
 * Uses the same AES-128 key as video encryption for consistency
 */
export class ThumbnailEncryptionService {
  constructor(private readonly deps: ThumbnailEncryptionServiceDependencies) {}

  /**
   * Encrypt a thumbnail file and save it with .enc extension
   * Original plaintext file is deleted after successful encryption
   */
  async encryptThumbnail(request: EncryptThumbnailRequest): Promise<EncryptThumbnailResponse> {
    const { videoId, thumbnailPath } = request;

    try {
      this.deps.logger?.info(`🔒 Encrypting thumbnail for video: ${videoId}`);

      // Read the original thumbnail
      const originalData = await fs.readFile(thumbnailPath);
      const originalSize = originalData.length;

      // Get the AES key for this video
      const key = await this.deps.aesKeyManager.getVideoKey(videoId);

      // Encrypt with IV header
      const encryptionResult = ThumbnailCryptoUtils.encryptWithIVHeader(originalData, key);

      if (!encryptionResult.success) {
        throw new Error(`Encryption failed: ${encryptionResult.error}`);
      }

      // Generate encrypted file path
      const encryptedPath = this.getEncryptedThumbnailPath(videoId);

      // Write encrypted data
      await fs.writeFile(encryptedPath, encryptionResult.data!);

      // Delete original plaintext file only if it's different from encrypted path
      if (encryptedPath !== thumbnailPath) {
        await fs.unlink(thumbnailPath);
      }

      const encryptedSize = encryptionResult.data!.length;

      this.deps.logger?.info(
        `✅ Thumbnail encrypted: ${videoId} (${originalSize}B → ${encryptedSize}B)`,
      );

      return {
        success: true,
        encryptedPath,
        originalSize,
        encryptedSize,
      };
    }
    catch (error) {
      this.deps.logger?.error(`❌ Failed to encrypt thumbnail for ${videoId}:`, error);
      throw new Error(
        `Failed to encrypt thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Decrypt a thumbnail and return the image data
   */
  async decryptThumbnail(request: DecryptThumbnailRequest): Promise<DecryptThumbnailResponse> {
    const { videoId } = request;

    try {
      this.deps.logger?.info(`🔓 Decrypting thumbnail for video: ${videoId}`);

      // Check if encrypted thumbnail exists
      const encryptedPath = this.getEncryptedThumbnailPath(videoId);
      const exists = await this.fileExists(encryptedPath);

      if (!exists) {
        throw new Error(`Encrypted thumbnail not found for video: ${videoId}`);
      }

      // Read encrypted data
      const encryptedData = await fs.readFile(encryptedPath);

      // Validate format
      if (!ThumbnailCryptoUtils.validateEncryptedFormat(encryptedData)) {
        throw new Error('Invalid encrypted thumbnail format');
      }

      // Get the AES key for this video
      const key = await this.deps.aesKeyManager.getVideoKey(videoId);

      // Decrypt the thumbnail
      const decryptionResult = ThumbnailCryptoUtils.decryptWithIVHeader(encryptedData, key);

      if (!decryptionResult.success) {
        throw new Error(`Decryption failed: ${decryptionResult.error}`);
      }

      this.deps.logger?.info(`✅ Thumbnail decrypted: ${videoId} (${decryptionResult.data!.length}B)`);

      return {
        imageBuffer: decryptionResult.data!,
        mimeType: 'image/jpeg', // Assuming JPEG thumbnails
        size: decryptionResult.data!.length,
      };
    }
    catch (error) {
      this.deps.logger?.error(`❌ Failed to decrypt thumbnail for ${videoId}:`, error);
      throw new Error(
        `Failed to decrypt thumbnail: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Check if encrypted thumbnail exists for a video
   * Validates both file existence and encryption format
   */
  async hasEncryptedThumbnail(videoId: string): Promise<boolean> {
    try {
      const encryptedPath = this.getEncryptedThumbnailPath(videoId);
      const exists = await this.fileExists(encryptedPath);

      if (!exists) {
        return false;
      }

      // Check if the file is actually encrypted by validating format
      const fileData = await fs.readFile(encryptedPath);
      return ThumbnailCryptoUtils.validateEncryptedFormat(fileData);
    }
    catch {
      return false;
    }
  }

  /**
   * Get the path for encrypted thumbnail
   */
  private getEncryptedThumbnailPath(videoId: string): string {
    return join(config.paths.videos, videoId, `thumbnail${ENCRYPTED_THUMBNAIL_EXTENSION}`);
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    }
    catch {
      return false;
    }
  }

  /**
   * Migrate existing plaintext thumbnail to encrypted format
   * Used for migration of existing thumbnails
   */
  async migrateExistingThumbnail(videoId: string): Promise<boolean> {
    try {
      const plaintextPath = join(config.paths.videos, videoId, 'thumbnail.jpg');
      const exists = await this.fileExists(plaintextPath);

      if (!exists) {
        return false; // No plaintext thumbnail to migrate
      }

      // Check if encrypted version already exists
      if (await this.hasEncryptedThumbnail(videoId)) {
        this.deps.logger?.info(`Encrypted thumbnail already exists for ${videoId}, skipping migration`);
        return true;
      }

      // Encrypt the existing thumbnail
      await this.encryptThumbnail({
        videoId,
        thumbnailPath: plaintextPath,
      });

      this.deps.logger?.info(`✅ Migrated thumbnail for video: ${videoId}`);
      return true;
    }
    catch (error) {
      this.deps.logger?.error(`❌ Failed to migrate thumbnail for ${videoId}:`, error);
      return false;
    }
  }
}
