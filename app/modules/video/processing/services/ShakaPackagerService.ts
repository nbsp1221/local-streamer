import { promises as fs } from 'fs';
import { join } from 'path';
import { config } from '~/configs';
import { getShakaPackagerPath } from '~/configs/ffmpeg';
import { executeFFmpegCommand } from '~/lib/ffmpeg-process-manager';
import type {
  EncryptionConfig,
  PackagingError,
  PackagingRequest,
  PackagingResult,
  ShakaCommandOptions,
  ShakaPackagerService,
  StreamConfig,
} from '../types/shaka-packager.types';
import {
  EncryptionError,
  ManifestGenerationError,
} from '../types/shaka-packager.types';
import { processExecutionService } from './ProcessExecutionService';

/**
 * Service responsible for packaging videos using Shaka Packager
 * Handles DASH manifest generation and AES-128 encryption
 */
export class ShakaPackagerServiceImpl implements ShakaPackagerService {
  /**
   * Package a video file into DASH format with encryption
   */
  async package(request: PackagingRequest): Promise<PackagingResult> {
    const { videoId, inputPath, outputDir, encryption, segmentDuration = 10, staticLiveMpd = true } = request;
    const startTime = Date.now();

    console.log(`📦 [ShakaPackager] Starting packaging for video: ${videoId}`);
    console.log(`📁 [ShakaPackager] Output directory: ${outputDir}`);

    // Create output directories
    await this.createOutputDirectories(outputDir);

    // Build Shaka Packager command options
    const commandOptions: ShakaCommandOptions = {
      input: inputPath,
      videoStream: {
        streamType: 'video',
        initSegment: join(outputDir, 'video', 'init.mp4'),
        segmentTemplate: join(outputDir, 'video', 'segment-$Number%04d$.m4s'),
        drmLabel: encryption.scheme !== 'none' ? (encryption.drmLabel || 'CENC') : undefined,
      },
      audioStream: {
        streamType: 'audio',
        initSegment: join(outputDir, 'audio', 'init.mp4'),
        segmentTemplate: join(outputDir, 'audio', 'segment-$Number%04d$.m4s'),
        drmLabel: encryption.scheme !== 'none' ? (encryption.drmLabel || 'CENC') : undefined,
      },
      encryption: encryption.scheme !== 'none' ? encryption : undefined,
      mpdOutput: join(outputDir, 'manifest.mpd'),
      segmentDuration,
      staticLiveMpd,
    };

    // Build command arguments
    const args = this.buildPackagerArgs(commandOptions);

    try {
      // Execute Shaka Packager
      await this.executeShakaPackager(args, videoId);

      // Verify output files
      const result = await this.verifyPackagingResult(outputDir);

      const duration = Date.now() - startTime;
      console.log(`✅ [ShakaPackager] Packaging completed in ${duration}ms`);
      console.log(`📊 [ShakaPackager] Created ${result.segmentCount} segments`);

      return {
        ...result,
        duration,
      };
    }
    catch (error) {
      console.error(`❌ [ShakaPackager] Packaging failed for video: ${videoId}`, error);

      if (error instanceof Error) {
        if (error.message.includes('encryption')) {
          throw new EncryptionError(error.message, inputPath, outputDir);
        }
        else if (error.message.includes('manifest')) {
          throw new ManifestGenerationError(inputPath, outputDir, error.message);
        }
      }

      throw error;
    }
  }

  /**
   * Build Shaka Packager command arguments
   */
  buildPackagerArgs(options: ShakaCommandOptions): string[] {
    const args: string[] = [];

    // Video stream configuration
    const videoStreamSpec = [
      `in=${options.input}`,
      'stream=video',
      `init_segment=${options.videoStream.initSegment}`,
      `segment_template=${options.videoStream.segmentTemplate}`,
    ];

    if (options.videoStream.drmLabel) {
      videoStreamSpec.push(`drm_label=${options.videoStream.drmLabel}`);
    }

    args.push(videoStreamSpec.join(','));

    // Audio stream configuration
    const audioStreamSpec = [
      `in=${options.input}`,
      'stream=audio',
      `init_segment=${options.audioStream.initSegment}`,
      `segment_template=${options.audioStream.segmentTemplate}`,
    ];

    if (options.audioStream.drmLabel) {
      audioStreamSpec.push(`drm_label=${options.audioStream.drmLabel}`);
    }

    args.push(audioStreamSpec.join(','));

    // Encryption configuration
    if (options.encryption && options.encryption.scheme !== 'none') {
      args.push('--enable_raw_key_encryption');
      args.push('--protection_scheme', options.encryption.scheme);

      // Keys configuration
      args.push('--keys');
      const keySpec = [
        `label=${options.encryption.drmLabel || 'CENC'}`,
        `key_id=${options.encryption.keyId}`,
        `key=${options.encryption.key}`,
      ];
      args.push(keySpec.join(':'));
    }

    // MPD configuration
    if (options.staticLiveMpd) {
      args.push('--generate_static_live_mpd');
    }

    args.push('--mpd_output', options.mpdOutput);
    args.push('--segment_duration', options.segmentDuration.toString());

    return args;
  }

  /**
   * Check if Shaka Packager is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const packagerPath = getShakaPackagerPath();
      await processExecutionService.execute({
        command: packagerPath,
        args: ['--version'],
        captureStdout: true,
      });
      return true;
    }
    catch {
      return false;
    }
  }

  /**
   * Get Shaka Packager version
   */
  async getVersion(): Promise<string> {
    try {
      const packagerPath = getShakaPackagerPath();
      const result = await processExecutionService.execute({
        command: packagerPath,
        args: ['--version'],
        captureStdout: true,
      });
      return result.stdout || 'Unknown';
    }
    catch {
      return 'Unknown';
    }
  }

  /**
   * List segments in a packaged directory
   */
  async listSegments(videoDir: string): Promise<string[]> {
    const segments: string[] = [];

    try {
      // List video segments
      const videoSegmentDir = join(videoDir, 'video');
      const videoFiles = await fs.readdir(videoSegmentDir);
      const videoSegments = videoFiles
        .filter(f => f.endsWith('.m4s'))
        .map(f => join('video', f));
      segments.push(...videoSegments);

      // List audio segments
      const audioSegmentDir = join(videoDir, 'audio');
      const audioFiles = await fs.readdir(audioSegmentDir);
      const audioSegments = audioFiles
        .filter(f => f.endsWith('.m4s'))
        .map(f => join('audio', f));
      segments.push(...audioSegments);

      // Sort segments
      segments.sort();
    }
    catch (error) {
      console.error(`❌ [ShakaPackager] Failed to list segments in ${videoDir}:`, error);
    }

    return segments;
  }

  /**
   * Create output directories for video and audio streams
   */
  private async createOutputDirectories(outputDir: string): Promise<void> {
    await fs.mkdir(join(outputDir, 'video'), { recursive: true });
    await fs.mkdir(join(outputDir, 'audio'), { recursive: true });
    console.log(`📁 [ShakaPackager] Created video/ and audio/ subdirectories`);
  }

  /**
   * Execute Shaka Packager command
   */
  private async executeShakaPackager(args: string[], videoId: string): Promise<void> {
    const packagerPath = getShakaPackagerPath();

    console.log(`🚀 [ShakaPackager] Executing: ${packagerPath} ${args.join(' ')}`);

    // Use executeFFmpegCommand for consistency with existing queue management
    await executeFFmpegCommand({
      command: packagerPath,
      args,
      onProgress: (data) => {
        // Shaka Packager doesn't provide detailed progress like FFmpeg
        // But we can still log output for debugging
        const line = data.toString();
        if (line.trim()) {
          console.log(`📦 [ShakaPackager] ${line}`);
        }
      },
    });
  }

  /**
   * Verify packaging result and count segments
   */
  private async verifyPackagingResult(outputDir: string): Promise<Omit<PackagingResult, 'duration'>> {
    // Check manifest exists
    const manifestPath = join(outputDir, 'manifest.mpd');
    try {
      await fs.access(manifestPath);
    }
    catch {
      throw new ManifestGenerationError('', outputDir, 'Manifest file not found');
    }

    // Check init segments
    const videoInitSegment = join(outputDir, 'video', 'init.mp4');
    const audioInitSegment = join(outputDir, 'audio', 'init.mp4');

    try {
      await fs.access(videoInitSegment);
      await fs.access(audioInitSegment);
    }
    catch {
      throw new Error('Init segments not found');
    }

    // Count segments
    const videoSegments: string[] = [];
    const audioSegments: string[] = [];

    // Read video segments
    const videoDir = join(outputDir, 'video');
    const videoFiles = await fs.readdir(videoDir);
    for (const file of videoFiles) {
      if (file.endsWith('.m4s')) {
        videoSegments.push(join(videoDir, file));
      }
    }

    // Read audio segments
    const audioDir = join(outputDir, 'audio');
    const audioFiles = await fs.readdir(audioDir);
    for (const file of audioFiles) {
      if (file.endsWith('.m4s')) {
        audioSegments.push(join(audioDir, file));
      }
    }

    const segmentCount = videoSegments.length + audioSegments.length;

    return {
      manifestPath,
      videoSegments,
      audioSegments,
      videoInitSegment,
      audioInitSegment,
      segmentCount,
    };
  }
}

// Export singleton instance
export const shakaPackagerService = new ShakaPackagerServiceImpl();
