import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { config, ffmpeg } from '~/configs';
import { AESKeyManager } from './aes-key-manager.server';
import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';
import { 
  DEFAULT_ENCODING_OPTIONS,
  getCodecName,
  getQualityParam,
  getQualityValue,
  getPresetValue,
  getAdditionalFlags,
  validateEncodingOptionsStrict
} from '~/utils/encoding';

export class HLSConverter {
  private keyManager: AESKeyManager;

  constructor() {
    this.keyManager = new AESKeyManager();
  }

  /**
   * Convert MP4 to HLS with AES-128 encryption
   * New structure: stores HLS files directly in video UUID folder
   */
  async convertVideo(videoId: string, inputPath: string, encodingOptions?: EncodingOptions): Promise<void> {
    console.log(`🎬 Starting HLS conversion for video: ${videoId}`);
    
    const videoDir = join(config.paths.videos, videoId);
    await fs.mkdir(videoDir, { recursive: true });
    
    try {
      // 1. Generate AES-128 key and keyinfo file
      const { keyInfoFile } = await this.keyManager.generateAndStoreVideoKey(videoId);
      
      // 2. Execute FFmpeg HLS conversion
      const playlistPath = join(videoDir, 'playlist.m3u8');
      const options = encodingOptions || DEFAULT_ENCODING_OPTIONS;
      await this.executeFFmpegConversion(inputPath, keyInfoFile, playlistPath, videoId, options);
      
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
    videoId: string,
    encodingOptions: EncodingOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Validate encoding options first
        validateEncodingOptionsStrict(encodingOptions);

        // Validate and sanitize segment duration
        const rawSegmentDuration = process.env.HLS_SEGMENT_DURATION || '10';
        const segmentDuration = this.validateSegmentDuration(rawSegmentDuration);

        const segmentPath = join(config.paths.videos, videoId, 'segment-%04d.ts');

        // Get validated encoding parameters
        const codec = this.validateCodec(getCodecName(encodingOptions.encoder));
        const preset = this.validatePreset(getPresetValue(encodingOptions.encoder), encodingOptions.encoder);
        const qualityParam = this.validateQualityParam(getQualityParam(encodingOptions.encoder));
        const qualityValue = this.validateQualityValue(getQualityValue(encodingOptions.encoder));
        const additionalFlags = this.validateAdditionalFlags(getAdditionalFlags(encodingOptions.encoder));

        const ffmpegArgs = [
          '-i', inputPath,
          '-hls_time', segmentDuration,
          '-hls_key_info_file', keyInfoFile,
          '-hls_playlist_type', 'vod',
          '-hls_flags', 'delete_segments+independent_segments',
          '-hls_segment_filename', segmentPath,
          '-c:v', codec,
          '-preset', preset,
          `-${qualityParam}`, qualityValue.toString(),
          ...additionalFlags,
          '-c:a', 'aac',
          '-b:a', '128k',
          '-ac', '2',
          '-ar', '44100',
          '-movflags', '+faststart',
          playlistPath
        ];

        console.log(`⚙️  Encoding Settings: ${codec} ${qualityParam}=${qualityValue} preset=${preset}`);
        console.log(`🔧 FFmpeg command: ${ffmpeg.ffmpegPath} ${ffmpegArgs.join(' ')}`);

        const ffmpegProcess = spawn(ffmpeg.ffmpegPath, ffmpegArgs);

        let stderrOutput = '';

        ffmpegProcess.stdout?.on('data', (data) => {
          console.log(`FFmpeg stdout: ${data}`);
        });

        ffmpegProcess.stderr?.on('data', (data) => {
          stderrOutput += data.toString();
          // Only log important progress information
          const output = data.toString();
          if (output.includes('frame=') || output.includes('time=')) {
            console.log(`FFmpeg progress: ${output.trim()}`);
          }
        });

        ffmpegProcess.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ FFmpeg conversion completed for ${videoId}`);
            resolve();
          }
          else {
            console.error(`❌ FFmpeg exited with code ${code} for ${videoId}`);
            console.error(`FFmpeg stderr: ${stderrOutput}`);
            reject(new Error(`FFmpeg conversion failed with code ${code}`));
          }
        });

        ffmpegProcess.on('error', (error) => {
          console.error(`❌ FFmpeg process error for ${videoId}:`, error);
          reject(error);
        });
      }
      catch (error) {
        console.error(`❌ FFmpeg validation error for ${videoId}:`, error);
        reject(error instanceof Error ? error : new Error('FFmpeg validation failed'));
      }
    });
  }

  /**
   * Validate segment duration parameter
   */
  private validateSegmentDuration(duration: string): string {
    const parsed = parseInt(duration, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 60) {
      throw new Error(`Invalid segment duration: ${duration}. Must be between 1 and 60 seconds.`);
    }
    return parsed.toString();
  }

  /**
   * Validate codec parameter
   */
  private validateCodec(codec: string): string {
    const allowedCodecs = ['libx265', 'hevc_nvenc'];
    if (!allowedCodecs.includes(codec)) {
      throw new Error(`Invalid codec: ${codec}. Allowed codecs: ${allowedCodecs.join(', ')}`);
    }
    return codec;
  }

  /**
   * Validate preset parameter
   */
  private validatePreset(preset: string, encoder: EncodingOptions['encoder']): string {
    const allowedPresets = encoder === 'gpu-h265' 
      ? ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']
      : ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'];
    
    if (!allowedPresets.includes(preset)) {
      throw new Error(`Invalid preset: ${preset} for encoder: ${encoder}. Allowed presets: ${allowedPresets.join(', ')}`);
    }
    return preset;
  }

  /**
   * Validate quality parameter name
   */
  private validateQualityParam(qualityParam: string): string {
    const allowedParams = ['crf', 'cq'];
    if (!allowedParams.includes(qualityParam)) {
      throw new Error(`Invalid quality parameter: ${qualityParam}. Allowed parameters: ${allowedParams.join(', ')}`);
    }
    return qualityParam;
  }

  /**
   * Validate quality value
   */
  private validateQualityValue(qualityValue: number): number {
    if (!Number.isInteger(qualityValue) || qualityValue < 0 || qualityValue > 51) {
      throw new Error(`Invalid quality value: ${qualityValue}. Must be an integer between 0 and 51.`);
    }
    return qualityValue;
  }

  /**
   * Validate additional flags for FFmpeg
   */
  private validateAdditionalFlags(flags: string[]): string[] {
    const allowedFlags = [
      '-tune', 'fastdecode', 'hq',
      '-rc', 'vbr'
    ];

    for (const flag of flags) {
      if (!allowedFlags.includes(flag)) {
        throw new Error(`Invalid additional flag: ${flag}. Allowed flags: ${allowedFlags.join(', ')}`);
      }
    }

    // Validate flag pairs (tune and rc flags should come in pairs)
    for (let i = 0; i < flags.length; i += 2) {
      const flagName = flags[i];
      const flagValue = flags[i + 1];
      
      if (flagName === '-tune' && !['fastdecode', 'hq'].includes(flagValue)) {
        throw new Error(`Invalid tune value: ${flagValue}. Allowed values: fastdecode, hq`);
      }
      
      if (flagName === '-rc' && flagValue !== 'vbr') {
        throw new Error(`Invalid rc value: ${flagValue}. Allowed values: vbr`);
      }
    }

    return flags;
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
