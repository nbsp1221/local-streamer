import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { XORCrypto } from '~/utils/xor-encryption.server';
import { security } from '~/configs/security';

/**
 * File Encryption Service
 * 
 * Provides high-level file encryption/decryption operations using XOR encryption.
 * Designed for encrypting video files during upload and decrypting during streaming.
 */
export class FileEncryption {
  private xorCrypto: XORCrypto;

  constructor() {
    this.xorCrypto = new XORCrypto({
      key: security.encryption.xorKey
    });
  }

  /**
   * Encrypt a file from input path to output path using streaming.
   * This is used when moving files from incoming folder to the video library.
   * 
   * @param inputPath - Path to the source file to encrypt
   * @param outputPath - Path where encrypted file will be saved
   * @returns Promise that resolves when encryption is complete
   */
  async encryptFile(inputPath: string, outputPath: string): Promise<void> {
    try {
      console.log(`🔐 Encrypting file: ${inputPath} → ${outputPath}`);
      
      const readStream = createReadStream(inputPath);
      const writeStream = createWriteStream(outputPath);
      const encryptStream = this.xorCrypto.createEncryptStream(0);

      // Pipeline: input file → encrypt → output file
      await pipeline(readStream, encryptStream, writeStream);
      
      console.log(`✅ File encrypted successfully: ${outputPath}`);
    } catch (error) {
      console.error(`❌ File encryption failed:`, error);
      throw new Error(`Failed to encrypt file from ${inputPath} to ${outputPath}: ${error}`);
    }
  }

  /**
   * Decrypt a file from input path to output path using streaming.
   * This is primarily used for testing or migration purposes.
   * 
   * @param inputPath - Path to the encrypted file
   * @param outputPath - Path where decrypted file will be saved
   * @returns Promise that resolves when decryption is complete
   */
  async decryptFile(inputPath: string, outputPath: string): Promise<void> {
    try {
      console.log(`🔓 Decrypting file: ${inputPath} → ${outputPath}`);
      
      const readStream = createReadStream(inputPath);
      const writeStream = createWriteStream(outputPath);
      const decryptStream = this.xorCrypto.createDecryptStream(0);

      // Pipeline: encrypted file → decrypt → output file
      await pipeline(readStream, decryptStream, writeStream);
      
      console.log(`✅ File decrypted successfully: ${outputPath}`);
    } catch (error) {
      console.error(`❌ File decryption failed:`, error);
      throw new Error(`Failed to decrypt file from ${inputPath} to ${outputPath}: ${error}`);
    }
  }

  /**
   * Create a decrypt stream for streaming API responses.
   * Used when serving encrypted video files with Range request support.
   * 
   * @param startOffset - Byte offset in the original file (for Range requests)
   * @returns Transform stream that decrypts data
   */
  createDecryptStream(startOffset: number = 0): Transform {
    return this.xorCrypto.createDecryptStream(startOffset);
  }

  /**
   * Create an encrypt stream for file processing.
   * 
   * @param startOffset - Byte offset to start encryption from
   * @returns Transform stream that encrypts data
   */
  createEncryptStream(startOffset: number = 0): Transform {
    return this.xorCrypto.createEncryptStream(startOffset);
  }

  /**
   * Get encryption information for debugging/monitoring.
   * Does not expose sensitive key data.
   */
  getEncryptionInfo() {
    return {
      algorithm: security.encryption.algorithm,
      chunkSize: security.encryption.chunkSize,
      keyInfo: this.xorCrypto.getKeyInfo()
    };
  }

  /**
   * Validate if a file can be decrypted (basic check).
   * This doesn't guarantee the file is valid, but can catch obvious issues.
   * 
   * @param filePath - Path to encrypted file
   * @returns Promise<boolean> indicating if file seems valid
   */
  async validateEncryptedFile(filePath: string): Promise<boolean> {
    try {
      const readStream = createReadStream(filePath, { start: 0, end: 1023 }); // Read first 1KB
      const decryptStream = this.createDecryptStream(0);
      
      return new Promise<boolean>((resolve) => {
        let hasData = false;
        
        decryptStream.on('data', (chunk) => {
          hasData = true;
        });
        
        decryptStream.on('end', () => {
          resolve(hasData);
        });
        
        decryptStream.on('error', () => {
          resolve(false);
        });
        
        readStream.pipe(decryptStream);
      });
    } catch (error) {
      console.error('Encrypted file validation failed:', error);
      return false;
    }
  }
}

/**
 * Singleton instance of FileEncryption service
 * This ensures consistent encryption key usage across the application
 */
let fileEncryptionInstance: FileEncryption | null = null;

/**
 * Get the FileEncryption service instance
 */
export function getFileEncryption(): FileEncryption {
  if (!fileEncryptionInstance) {
    fileEncryptionInstance = new FileEncryption();
  }
  return fileEncryptionInstance;
}

/**
 * Convenience function to encrypt a file
 */
export async function encryptFile(inputPath: string, outputPath: string): Promise<void> {
  const service = getFileEncryption();
  return service.encryptFile(inputPath, outputPath);
}

/**
 * Convenience function to decrypt a file
 */
export async function decryptFile(inputPath: string, outputPath: string): Promise<void> {
  const service = getFileEncryption();
  return service.decryptFile(inputPath, outputPath);
}

/**
 * Convenience function to create a decrypt stream
 */
export function createDecryptStream(startOffset: number = 0): Transform {
  const service = getFileEncryption();
  return service.createDecryptStream(startOffset);
}