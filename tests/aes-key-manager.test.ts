import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AESKeyManager } from '../app/services/aes-key-manager.server';

// Mock environment variables for testing
const mockEnv = {
  HLS_MASTER_ENCRYPTION_SEED: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  KEY_SALT_PREFIX: 'test-salt-prefix',
  KEY_DERIVATION_ROUNDS: '1000', // Lower rounds for faster tests
};

const testVideoId = 'test-video-123';

describe('AESKeyManager', () => {
  let keyManager: AESKeyManager;
  let testDir: string;
  let originalEnv: { [key: string]: string | undefined };

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aes-key-test-'));

    // Backup original environment variables
    originalEnv = {};
    Object.keys(mockEnv).forEach((key) => {
      originalEnv[key] = process.env[key];
    });

    // Set up test environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Create AESKeyManager with mocked config path
    keyManager = new (class extends AESKeyManager {
      async storeVideoKey(videoId: string, key: Buffer): Promise<void> {
        const hlsDir = path.join(testDir, videoId, 'hls');
        await fs.mkdir(hlsDir, { recursive: true });

        const keyPath = path.join(hlsDir, 'key.bin');
        await fs.writeFile(keyPath, key);
      }

      async getVideoKey(videoId: string): Promise<Buffer> {
        const keyPath = path.join(testDir, videoId, 'hls', 'key.bin');
        return await fs.readFile(keyPath);
      }

      async hasVideoKey(videoId: string): Promise<boolean> {
        try {
          const keyPath = path.join(testDir, videoId, 'hls', 'key.bin');
          await fs.access(keyPath);
          return true;
        }
        catch {
          return false;
        }
      }

      async createKeyInfoFile(videoId: string): Promise<string> {
        const hlsDir = path.join(testDir, videoId, 'hls');
        const keyInfoPath = path.join(hlsDir, 'keyinfo.txt');

        const keyUrl = `/api/hls-key/${videoId}`;
        const keyPath = path.join(hlsDir, 'key.bin');

        const keyInfo = `${keyUrl}\n${keyPath}\n`;
        await fs.writeFile(keyInfoPath, keyInfo);

        return keyInfoPath;
      }

      async cleanupTempFiles(videoId: string): Promise<void> {
        try {
          const keyInfoPath = path.join(testDir, videoId, 'hls', 'keyinfo.txt');
          await fs.unlink(keyInfoPath);
        }
        catch {
          // Ignore cleanup errors
        }
      }
    })();
  });

  afterEach(async () => {
    // Restore original environment variables
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      }
      else {
        process.env[key] = value;
      }
    });

    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    }
    catch {
      // Ignore cleanup errors
    }
  });

  describe('generateVideoKey', () => {
    it('should generate consistent 16-byte keys for same video ID', () => {
      const key1 = keyManager.generateVideoKey(testVideoId);
      const key2 = keyManager.generateVideoKey(testVideoId);

      expect(key1).toEqual(key2);
      expect(key1).toHaveLength(16); // AES-128 = 16 bytes
      expect(Buffer.isBuffer(key1)).toBe(true);
    });

    it('should generate different keys for different video IDs', () => {
      const key1 = keyManager.generateVideoKey('video-1');
      const key2 = keyManager.generateVideoKey('video-2');

      expect(key1).not.toEqual(key2);
      expect(key1).toHaveLength(16);
      expect(key2).toHaveLength(16);
    });

    it('should generate secure keys (non-zero)', () => {
      const key = keyManager.generateVideoKey(testVideoId);
      const keyArray = Array.from(key);

      // Key should not be all zeros (extremely unlikely with proper PBKDF2)
      expect(keyArray.some(byte => byte !== 0)).toBe(true);
    });
  });

  describe('storeVideoKey and getVideoKey', () => {
    it('should store and retrieve video keys', async () => {
      const originalKey = keyManager.generateVideoKey(testVideoId);

      await keyManager.storeVideoKey(testVideoId, originalKey);
      const retrievedKey = await keyManager.getVideoKey(testVideoId);

      expect(retrievedKey).toEqual(originalKey);
    });

    it('should create directory structure when storing key', async () => {
      const key = keyManager.generateVideoKey(testVideoId);

      await keyManager.storeVideoKey(testVideoId, key);

      const hlsDir = path.join(testDir, testVideoId, 'hls');
      const keyPath = path.join(hlsDir, 'key.bin');

      expect(await fs.access(hlsDir).then(() => true).catch(() => false)).toBe(true);
      expect(await fs.access(keyPath).then(() => true).catch(() => false)).toBe(true);
    });

    it('should throw error when getting non-existent key', async () => {
      await expect(keyManager.getVideoKey('non-existent-video')).rejects.toThrow();
    });
  });

  describe('hasVideoKey', () => {
    it('should return false for non-existent key', async () => {
      const hasKey = await keyManager.hasVideoKey('non-existent-video');
      expect(hasKey).toBe(false);
    });

    it('should return true for existing key', async () => {
      const key = keyManager.generateVideoKey(testVideoId);
      await keyManager.storeVideoKey(testVideoId, key);

      const hasKey = await keyManager.hasVideoKey(testVideoId);
      expect(hasKey).toBe(true);
    });
  });

  describe('createKeyInfoFile', () => {
    it('should create keyinfo file with correct format', async () => {
      const key = keyManager.generateVideoKey(testVideoId);
      await keyManager.storeVideoKey(testVideoId, key);

      const keyInfoPath = await keyManager.createKeyInfoFile(testVideoId);
      const keyInfoContent = await fs.readFile(keyInfoPath, 'utf-8');

      expect(keyInfoContent).toContain(`/api/hls-key/${testVideoId}`);
      expect(keyInfoContent).toContain('key.bin');
    });
  });

  describe('generateAndStoreVideoKey', () => {
    it('should generate, store key and create keyinfo file', async () => {
      const result = await keyManager.generateAndStoreVideoKey(testVideoId);

      expect(Buffer.isBuffer(result.key)).toBe(true);
      expect(result.key).toHaveLength(16);
      expect(typeof result.keyInfoFile).toBe('string');

      // Verify key was stored
      const retrievedKey = await keyManager.getVideoKey(testVideoId);
      expect(retrievedKey).toEqual(result.key);

      // Verify keyinfo file exists
      expect(await fs.access(result.keyInfoFile).then(() => true).catch(() => false)).toBe(true);
    });
  });

  describe('cleanupTempFiles', () => {
    it('should remove keyinfo file without throwing error', async () => {
      await keyManager.generateAndStoreVideoKey(testVideoId);

      // Should not throw even if keyinfo file exists or doesn't exist
      await keyManager.cleanupTempFiles(testVideoId);
      await keyManager.cleanupTempFiles('non-existent');

      // If we reach this point, no error was thrown
      expect(true).toBe(true);
    });
  });

  describe('constructor validation', () => {
    it('should throw error if VIDEO_MASTER_ENCRYPTION_SEED is missing in non-test environment', () => {
      // Store original values
      const originalVideoSeed = process.env.VIDEO_MASTER_ENCRYPTION_SEED;
      const originalHlsSeed = process.env.HLS_MASTER_ENCRYPTION_SEED;
      const originalNodeEnv = process.env.NODE_ENV;
      const originalVitest = process.env.VITEST;

      // Delete both old and new environment variables
      delete process.env.VIDEO_MASTER_ENCRYPTION_SEED;
      delete process.env.HLS_MASTER_ENCRYPTION_SEED;

      // Simulate non-test environment
      delete process.env.NODE_ENV;
      delete process.env.VITEST;

      try {
        expect(() => new AESKeyManager()).toThrow('VIDEO_MASTER_ENCRYPTION_SEED environment variable is required for video encryption');
      }
      finally {
        // Restore environment variables
        if (originalVideoSeed) process.env.VIDEO_MASTER_ENCRYPTION_SEED = originalVideoSeed;
        if (originalHlsSeed) process.env.HLS_MASTER_ENCRYPTION_SEED = originalHlsSeed;
        if (originalNodeEnv) process.env.NODE_ENV = originalNodeEnv;
        if (originalVitest) process.env.VITEST = originalVitest;
      }
    });
  });

  describe('key derivation security', () => {
    it('should use different salts for different video IDs', () => {
      // This test ensures that the salt generation is deterministic but unique per video
      const key1a = keyManager.generateVideoKey('video-1');
      const key1b = keyManager.generateVideoKey('video-1');
      const key2 = keyManager.generateVideoKey('video-2');

      // Same video ID should produce same key
      expect(key1a).toEqual(key1b);

      // Different video IDs should produce different keys
      expect(key1a).not.toEqual(key2);
    });

    it('should handle special characters in video IDs', () => {
      const specialIds = [
        'video-with-dashes',
        'video_with_underscores',
        'video.with.dots',
        'video123numbers',
        'UPPERCASE-video',
      ];

      const keys = specialIds.map(id => keyManager.generateVideoKey(id));

      // All keys should be unique
      const uniqueKeys = new Set(keys.map(key => key.toString('hex')));
      expect(uniqueKeys.size).toBe(specialIds.length);

      // All keys should be proper length
      keys.forEach((key) => {
        expect(key).toHaveLength(16);
      });
    });
  });
});
