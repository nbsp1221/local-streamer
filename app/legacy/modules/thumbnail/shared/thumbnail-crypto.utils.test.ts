import { describe, expect, it } from 'vitest';
import { ThumbnailCryptoUtils } from './thumbnail-crypto.utils';
import { THUMBNAIL_IV_SIZE } from './thumbnail-encryption.types';

describe('ThumbnailCryptoUtils', () => {
  const testKey = Buffer.from('0123456789abcdef'); // 16-byte test key for AES-128
  const testImageData = Buffer.from('fake image data for testing');

  describe('generateIV', () => {
    it('should generate a 16-byte IV', () => {
      const iv = ThumbnailCryptoUtils.generateIV();

      expect(iv).toBeInstanceOf(Buffer);
      expect(iv.length).toBe(THUMBNAIL_IV_SIZE);
    });

    it('should generate different IVs each time', () => {
      const iv1 = ThumbnailCryptoUtils.generateIV();
      const iv2 = ThumbnailCryptoUtils.generateIV();

      expect(iv1.equals(iv2)).toBe(false);
    });
  });

  describe('encryptWithIVHeader', () => {
    it('should encrypt data successfully', () => {
      const result = ThumbnailCryptoUtils.encryptWithIVHeader(testImageData, testKey);

      expect(result.success).toBe(true);
      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data!.length).toBeGreaterThan(THUMBNAIL_IV_SIZE);
      expect(result.error).toBeUndefined();
    });

    it('should include IV in the header', () => {
      const result = ThumbnailCryptoUtils.encryptWithIVHeader(testImageData, testKey);

      expect(result.success).toBe(true);

      // The result should be longer than the original data + IV
      expect(result.data!.length).toBeGreaterThan(testImageData.length + THUMBNAIL_IV_SIZE);

      // First 16 bytes should be the IV
      const ivFromResult = result.data!.subarray(0, THUMBNAIL_IV_SIZE);
      expect(ivFromResult.length).toBe(THUMBNAIL_IV_SIZE);
    });

    it('should handle encryption errors gracefully', () => {
      const invalidKey = Buffer.from('invalid'); // Wrong key size

      const result = ThumbnailCryptoUtils.encryptWithIVHeader(testImageData, invalidKey);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
    });
  });

  describe('parseEncryptedHeader', () => {
    it('should parse valid encrypted header', () => {
      const mockIV = Buffer.alloc(THUMBNAIL_IV_SIZE, 'a');
      const mockEncryptedData = Buffer.from('encrypted data');
      const mockEncryptedBuffer = Buffer.concat([mockIV, mockEncryptedData]);

      const result = ThumbnailCryptoUtils.parseEncryptedHeader(mockEncryptedBuffer);

      expect(result).not.toBeNull();
      expect(result!.iv.equals(mockIV)).toBe(true);
      expect(result!.encryptedData.equals(mockEncryptedData)).toBe(true);
    });

    it('should return null for invalid header (too short)', () => {
      const tooShortBuffer = Buffer.alloc(10); // Less than 16 bytes

      const result = ThumbnailCryptoUtils.parseEncryptedHeader(tooShortBuffer);

      expect(result).toBeNull();
    });

    it('should handle empty encrypted data', () => {
      const mockIV = Buffer.alloc(THUMBNAIL_IV_SIZE, 'a');
      const emptyEncryptedData = Buffer.alloc(0);
      const mockEncryptedBuffer = Buffer.concat([mockIV, emptyEncryptedData]);

      const result = ThumbnailCryptoUtils.parseEncryptedHeader(mockEncryptedBuffer);

      expect(result).not.toBeNull();
      expect(result!.iv.equals(mockIV)).toBe(true);
      expect(result!.encryptedData.length).toBe(0);
    });
  });

  describe('decryptWithIVHeader', () => {
    it('should decrypt data successfully with correct key', () => {
      // First encrypt some data
      const encryptResult = ThumbnailCryptoUtils.encryptWithIVHeader(testImageData, testKey);
      expect(encryptResult.success).toBe(true);

      // Then decrypt it
      const decryptResult = ThumbnailCryptoUtils.decryptWithIVHeader(encryptResult.data!, testKey);

      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data!.equals(testImageData)).toBe(true);
      expect(decryptResult.error).toBeUndefined();
    });

    it('should fail with wrong key', () => {
      const wrongKey = Buffer.from('wrongkey12345678'); // Different key

      // Encrypt with correct key
      const encryptResult = ThumbnailCryptoUtils.encryptWithIVHeader(testImageData, testKey);
      expect(encryptResult.success).toBe(true);

      // Try to decrypt with wrong key
      const decryptResult = ThumbnailCryptoUtils.decryptWithIVHeader(encryptResult.data!, wrongKey);

      expect(decryptResult.success).toBe(false);
      expect(decryptResult.error).toBeDefined();
      expect(decryptResult.data).toBeUndefined();
    });

    it('should handle invalid encrypted format', () => {
      const invalidBuffer = Buffer.alloc(10); // Too short

      const result = ThumbnailCryptoUtils.decryptWithIVHeader(invalidBuffer, testKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid encrypted thumbnail format');
      expect(result.data).toBeUndefined();
    });
  });

  describe('validateEncryptedFormat', () => {
    it('should validate correct format', () => {
      const validBuffer = Buffer.alloc(THUMBNAIL_IV_SIZE + 10);

      const isValid = ThumbnailCryptoUtils.validateEncryptedFormat(validBuffer);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect format', () => {
      const invalidBuffer = Buffer.alloc(THUMBNAIL_IV_SIZE - 1); // Too short

      const isValid = ThumbnailCryptoUtils.validateEncryptedFormat(invalidBuffer);

      expect(isValid).toBe(false);
    });

    it('should reject empty buffer', () => {
      const emptyBuffer = Buffer.alloc(0);

      const isValid = ThumbnailCryptoUtils.validateEncryptedFormat(emptyBuffer);

      expect(isValid).toBe(false);
    });
  });

  describe('full encryption/decryption cycle', () => {
    it('should maintain data integrity through full cycle', () => {
      const originalData = Buffer.from('This is test image data that should remain unchanged after encryption and decryption');

      // Encrypt
      const encryptResult = ThumbnailCryptoUtils.encryptWithIVHeader(originalData, testKey);
      expect(encryptResult.success).toBe(true);

      // Validate format
      const isValidFormat = ThumbnailCryptoUtils.validateEncryptedFormat(encryptResult.data!);
      expect(isValidFormat).toBe(true);

      // Decrypt
      const decryptResult = ThumbnailCryptoUtils.decryptWithIVHeader(encryptResult.data!, testKey);
      expect(decryptResult.success).toBe(true);

      // Verify integrity
      expect(decryptResult.data!.equals(originalData)).toBe(true);
    });

    it('should handle large data correctly', () => {
      const largeData = Buffer.alloc(1024 * 100, 'x'); // 100KB of data

      // Encrypt
      const encryptResult = ThumbnailCryptoUtils.encryptWithIVHeader(largeData, testKey);
      expect(encryptResult.success).toBe(true);

      // Decrypt
      const decryptResult = ThumbnailCryptoUtils.decryptWithIVHeader(encryptResult.data!, testKey);
      expect(decryptResult.success).toBe(true);
      expect(decryptResult.data!.equals(largeData)).toBe(true);
    });
  });
});
