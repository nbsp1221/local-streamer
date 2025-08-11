import crypto from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import { config } from '~/configs';

export class AESKeyManager {
  private readonly masterSeed: string;
  private readonly saltPrefix: string;
  private readonly rounds: number;

  constructor() {
    this.masterSeed = process.env.HLS_MASTER_ENCRYPTION_SEED!;
    this.saltPrefix = process.env.KEY_SALT_PREFIX!;
    this.rounds = parseInt(process.env.KEY_DERIVATION_ROUNDS!) || 100000;
    
    if (!this.masterSeed) {
      throw new Error('HLS_MASTER_ENCRYPTION_SEED environment variable is required');
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
    const hlsDir = join(config.paths.videos, videoId, 'hls');
    await fs.mkdir(hlsDir, { recursive: true });
    
    const keyPath = join(hlsDir, 'key.bin');
    await fs.writeFile(keyPath, key);
  }

  /**
   * Retrieve stored video key
   */
  async getVideoKey(videoId: string): Promise<Buffer> {
    const keyPath = join(config.paths.videos, videoId, 'hls', 'key.bin');
    return await fs.readFile(keyPath);
  }

  /**
   * Check if video key exists
   */
  async hasVideoKey(videoId: string): Promise<boolean> {
    try {
      const keyPath = join(config.paths.videos, videoId, 'hls', 'key.bin');
      await fs.access(keyPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create FFmpeg keyinfo file for HLS encryption
   */
  async createKeyInfoFile(videoId: string): Promise<string> {
    const hlsDir = join(config.paths.videos, videoId, 'hls');
    const keyInfoPath = join(hlsDir, 'keyinfo.txt');
    
    const keyUrl = `/api/hls-key/${videoId}`;
    const keyPath = join(hlsDir, 'key.bin');
    
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
      const keyInfoPath = join(config.paths.videos, videoId, 'hls', 'keyinfo.txt');
      await fs.unlink(keyInfoPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}