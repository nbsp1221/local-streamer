import crypto from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { config } from '~/configs';

export class AESKeyManager {
  private readonly masterSeed: string;
  private readonly saltPrefix: string;
  private readonly rounds: number;

  constructor() {
    // Use test defaults in test environment
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

    if (isTest) {
      this.masterSeed = 'test-master-seed-for-unit-tests-only';
      this.saltPrefix = 'test-salt';
      this.rounds = 100000;
    }
    else {
      this.masterSeed = config.security.video.masterSeed;
      this.saltPrefix = config.security.video.keyDerivation.saltPrefix;
      this.rounds = config.security.video.keyDerivation.rounds;
    }
  }

  /**
   * Generate unique AES-128 key for video ID using PBKDF2
   */
  generateVideoKey(videoId: string): Buffer {
    const salt = crypto.createHash('sha256')
      .update(this.saltPrefix + videoId)
      .digest();

    return crypto.pbkdf2Sync(this.masterSeed, salt, this.rounds, 16, 'sha256');
  }

  /**
   * Store video key to filesystem
   */
  async storeVideoKey(videoId: string, key: Buffer): Promise<void> {
    const videoDir = join(config.paths.videos, videoId);
    await fs.mkdir(videoDir, { recursive: true });

    const keyPath = join(videoDir, 'key.bin');
    await fs.writeFile(keyPath, key);
  }

  /**
   * Retrieve stored video key
   */
  async getVideoKey(videoId: string): Promise<Buffer> {
    const keyPath = join(config.paths.videos, videoId, 'key.bin');
    return await fs.readFile(keyPath);
  }

  /**
   * Check if video key exists
   */
  async hasVideoKey(videoId: string): Promise<boolean> {
    try {
      const keyPath = join(config.paths.videos, videoId, 'key.bin');
      await fs.access(keyPath);
      return true;
    }
    catch {
      return false;
    }
  }

  /**
   * Create FFmpeg keyinfo file for video encryption
   */
  async createKeyInfoFile(videoId: string): Promise<string> {
    const videoDir = join(config.paths.videos, videoId);
    const keyInfoPath = join(videoDir, 'keyinfo.txt');

    const keyUrl = `/api/video-key/${videoId}`;
    const keyPath = join(videoDir, 'key.bin');

    const keyInfo = `${keyUrl}\n${keyPath}\n`;
    await fs.writeFile(keyInfoPath, keyInfo);

    return keyInfoPath;
  }

  /**
   * Generate both key and keyinfo file in one operation
   */
  async generateAndStoreVideoKey(videoId: string): Promise<{ key: Buffer; keyInfoFile: string }> {
    const key = this.generateVideoKey(videoId);
    await this.storeVideoKey(videoId, key);
    const keyInfoFile = await this.createKeyInfoFile(videoId);

    return { key, keyInfoFile };
  }

  /**
   * Clean up temporary files (keyinfo.txt)
   */
  async cleanupTempFiles(videoId: string): Promise<void> {
    try {
      const keyInfoPath = join(config.paths.videos, videoId, 'keyinfo.txt');
      await fs.unlink(keyInfoPath);
    }
    catch {
      // Ignore cleanup errors
    }
  }
}
