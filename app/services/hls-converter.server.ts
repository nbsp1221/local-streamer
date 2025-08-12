import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import ffmpegStatic from 'ffmpeg-static';
import { config } from '~/configs';
import { AESKeyManager } from './aes-key-manager.server';

export class HLSConverter {
  private keyManager: AESKeyManager;

  constructor() {
    this.keyManager = new AESKeyManager();
  }

  /**
   * Convert MP4 to HLS with AES-128 encryption
   * New structure: stores HLS files directly in video UUID folder
   */
  async convertVideo(videoId: string, inputPath: string): Promise<void> {
    console.log(`🎬 Starting HLS conversion for video: ${videoId}`);
    
    const videoDir = join(config.paths.videos, videoId);
    await fs.mkdir(videoDir, { recursive: true });
    
    try {
      // 1. Generate AES-128 key and keyinfo file
      const { keyInfoFile } = await this.keyManager.generateAndStoreVideoKey(videoId);
      
      // 2. Execute FFmpeg HLS conversion
      const playlistPath = join(videoDir, 'playlist.m3u8');
      await this.executeFFmpegConversion(inputPath, keyInfoFile, playlistPath, videoId);
      
      // 3. Cleanup temporary files
      await this.keyManager.cleanupTempFiles(videoId);
      
      // 4. Remove original file to save storage
      await this.removeOriginalFile(inputPath);
      
      console.log(`✅ HLS conversion completed for video: ${videoId}`);
    } catch (error) {
      console.error(`❌ HLS conversion failed for video: ${videoId}`, error);
      await this.cleanup(videoId);
      throw error;
    }
  }

  private async executeFFmpegConversion(
    inputPath: string, 
    keyInfoFile: string, 
    playlistPath: string,
    videoId: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const segmentDuration = process.env.HLS_SEGMENT_DURATION || '10';
      const segmentPath = join(config.paths.videos, videoId, 'segment-%04d.ts');
      
      const ffmpegArgs = [
        '-i', inputPath,
        '-hls_time', segmentDuration,
        '-hls_key_info_file', keyInfoFile,
        '-hls_playlist_type', 'vod',
        '-hls_flags', 'delete_segments+independent_segments',
        '-hls_segment_filename', segmentPath,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-maxrate', '2M',
        '-bufsize', '4M',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ac', '2',
        '-ar', '44100',
        '-movflags', '+faststart',
        playlistPath
      ];

      console.log(`🔧 FFmpeg command: ${ffmpegStatic} ${ffmpegArgs.join(' ')}`);

      const ffmpeg = spawn(ffmpegStatic!, ffmpegArgs);
      
      let stderrOutput = '';
      
      ffmpeg.stdout?.on('data', (data) => {
        console.log(`FFmpeg stdout: ${data}`);
      });
      
      ffmpeg.stderr?.on('data', (data) => {
        stderrOutput += data.toString();
        // Only log important progress information
        const output = data.toString();
        if (output.includes('frame=') || output.includes('time=')) {
          console.log(`FFmpeg progress: ${output.trim()}`);
        }
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ FFmpeg conversion completed for ${videoId}`);
          resolve();
        } else {
          console.error(`❌ FFmpeg exited with code ${code} for ${videoId}`);
          console.error(`FFmpeg stderr: ${stderrOutput}`);
          reject(new Error(`FFmpeg conversion failed with code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        console.error(`❌ FFmpeg process error for ${videoId}:`, error);
        reject(error);
      });
    });
  }

  /**
   * Check if HLS conversion is available for video
   */
  async isHLSAvailable(videoId: string): Promise<boolean> {
    try {
      const playlistPath = join(config.paths.videos, videoId, 'playlist.m3u8');
      await fs.access(playlistPath);
      return await this.keyManager.hasVideoKey(videoId);
    } catch {
      return false;
    }
  }

  /**
   * Get HLS playlist content
   */
  async getPlaylist(videoId: string): Promise<string> {
    const playlistPath = join(config.paths.videos, videoId, 'playlist.m3u8');
    return await fs.readFile(playlistPath, 'utf-8');
  }

  /**
   * Get list of HLS segments for a video
   */
  async getSegmentList(videoId: string): Promise<string[]> {
    try {
      const videoDir = join(config.paths.videos, videoId);
      const files = await fs.readdir(videoDir);
      return files.filter(file => file.endsWith('.ts')).sort();
    } catch {
      return [];
    }
  }

  /**
   * Get segment file path
   */
  getSegmentPath(videoId: string, segmentName: string): string {
    return join(config.paths.videos, videoId, segmentName);
  }

  /**
   * Validate segment name to prevent path traversal attacks
   */
  isValidSegmentName(segmentName: string): boolean {
    // Check for path traversal patterns
    if (segmentName.includes('..') || segmentName.includes('/') || segmentName.includes('\\')) {
      return false;
    }
    
    // Check for null bytes (security vulnerability)
    if (segmentName.includes('\0')) {
      return false;
    }
    
    // Updated pattern for new segment naming: segment-0000.ts
    return /^segment-\d{4}\.ts$/.test(segmentName);
  }

  /**
   * Clean up HLS files for a video
   */
  async cleanup(videoId: string): Promise<void> {
    try {
      const videoDir = join(config.paths.videos, videoId);
      await fs.rm(videoDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up HLS files for video: ${videoId}`);
    } catch (error) {
      console.error(`⚠️  Failed to cleanup HLS files for ${videoId}:`, error);
    }
  }

  /**
   * Get HLS conversion progress info (for future use)
   */
  getConversionInfo(videoId: string): { videoDir: string; playlistPath: string } {
    const videoDir = join(config.paths.videos, videoId);
    const playlistPath = join(videoDir, 'playlist.m3u8');
    
    return { videoDir, playlistPath };
  }

  /**
   * Remove original file after successful HLS conversion
   */
  private async removeOriginalFile(originalPath: string): Promise<void> {
    try {
      await fs.unlink(originalPath);
      console.log(`🗑️  Removed original file: ${originalPath}`);
    } catch (error) {
      console.warn(`⚠️  Failed to remove original file ${originalPath}:`, error);
      // Don't throw error - HLS conversion succeeded, original cleanup is non-critical
    }
  }
}