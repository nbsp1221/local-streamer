import crypto from 'crypto';
import {
  type EncryptedThumbnailHeader,
  type ThumbnailDecryptionResult,
  type ThumbnailEncryptionResult,
  THUMBNAIL_IV_SIZE,
} from './thumbnail-encryption.types';

/**
 * Thumbnail cryptographic utilities using AES-128-CBC
 */
export class ThumbnailCryptoUtils {
  private static readonly ALGORITHM = 'aes-128-cbc';

  /**
   * Generate a random 16-byte IV for AES-128
   */
  static generateIV(): Buffer {
    return crypto.randomBytes(THUMBNAIL_IV_SIZE);
  }

  /**
   * Encrypt image data with AES-128-CBC and prepend IV to the result
   * Format: [16 bytes IV][Encrypted data]
   */
  static encryptWithIVHeader(imageData: Buffer, key: Buffer): ThumbnailEncryptionResult {
    try {
      // Generate random IV
      const iv = this.generateIV();

      // Create cipher
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      // Encrypt the image data
      const encryptedChunks: Buffer[] = [];
      encryptedChunks.push(cipher.update(imageData));
      encryptedChunks.push(cipher.final());

      const encryptedData = Buffer.concat(encryptedChunks);

      // Combine IV + encrypted data
      const result = Buffer.concat([iv, encryptedData]);

      return {
        success: true,
        data: result,
      };
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Encryption failed',
      };
    }
  }

  /**
   * Extract IV and encrypted data from the header format
   * Format: [16 bytes IV][Encrypted data]
   */
  static parseEncryptedHeader(encryptedBuffer: Buffer): EncryptedThumbnailHeader | null {
    if (encryptedBuffer.length < THUMBNAIL_IV_SIZE) {
      return null;
    }

    const iv = encryptedBuffer.subarray(0, THUMBNAIL_IV_SIZE);
    const encryptedData = encryptedBuffer.subarray(THUMBNAIL_IV_SIZE);

    return { iv, encryptedData };
  }

  /**
   * Decrypt image data using the IV from the header
   */
  static decryptWithIVHeader(encryptedBuffer: Buffer, key: Buffer): ThumbnailDecryptionResult {
    try {
      // Parse the header
      const header = this.parseEncryptedHeader(encryptedBuffer);
      if (!header) {
        return {
          success: false,
          error: 'Invalid encrypted thumbnail format: missing or corrupt IV header',
        };
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, header.iv);

      // Decrypt the data
      const decryptedChunks: Buffer[] = [];
      decryptedChunks.push(decipher.update(header.encryptedData));
      decryptedChunks.push(decipher.final());

      const decryptedData = Buffer.concat(decryptedChunks);

      return {
        success: true,
        data: decryptedData,
      };
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Decryption failed',
      };
    }
  }

  /**
   * Verify that the encrypted data has valid structure
   * Checks if the file follows our encrypted format and is not a plain JPEG
   */
  static validateEncryptedFormat(encryptedBuffer: Buffer): boolean {
    // Basic length check
    if (encryptedBuffer.length <= THUMBNAIL_IV_SIZE) {
      return false;
    }

    // Check if it starts with JPEG magic bytes (indicating it's unencrypted)
    if (encryptedBuffer.length >= 2 &&
      encryptedBuffer[0] === 0xFF &&
      encryptedBuffer[1] === 0xD8) {
      return false; // This is a plain JPEG file
    }

    // Additional validation: encrypted data should not have recognizable patterns
    // The first 16 bytes should be random IV, not structured data
    const firstBytes = encryptedBuffer.subarray(0, Math.min(4, encryptedBuffer.length));

    // Check for other common image format magic bytes
    const magicBytes = Array.from(firstBytes);

    // PNG magic bytes: 89 50 4E 47
    if (magicBytes.length >= 4 &&
      magicBytes[0] === 0x89 && magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x4E && magicBytes[3] === 0x47) {
      return false;
    }

    // WebP magic bytes: starts with RIFF
    if (magicBytes.length >= 4 &&
      magicBytes[0] === 0x52 && magicBytes[1] === 0x49 &&
      magicBytes[2] === 0x46 && magicBytes[3] === 0x46) {
      return false;
    }

    return true; // Likely encrypted data
  }
}
