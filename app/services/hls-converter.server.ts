import { spawn } from 'child_process';
import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { EncodingOptions, EnhancedEncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { VideoAnalysisRepository } from '~/modules/video/analysis/repositories/video-analysis-repository.types';
import type { VideoAnalysis, VideoAnalysisService } from '~/modules/video/analysis/video-analysis.types';
import { config, ffmpeg } from '~/configs';
import { executeFFmpegCommand } from '~/lib/ffmpeg-process-manager';
import { FFprobeAnalysisService } from '~/modules/video/analysis/ffprobe-analysis.service';
import {
  DEFAULT_ENCODING_OPTIONS,
  getAdditionalFlags,
  getCodecName,
  getPresetValue,
  getQualityParam,
  getQualityValue,
  validateEncodingOptionsStrict,
} from '~/utils/encoding';
import { AESKeyManager } from './aes-key-manager.server';
import { generateSmartThumbnail } from './thumbnail-generator.server';

export class HLSConverter {
  private keyManager: AESKeyManager;
  private analysisService: VideoAnalysisService;

  constructor(analysisService?: VideoAnalysisService, repository?: VideoAnalysisRepository) {
    this.keyManager = new AESKeyManager();

    if (analysisService) {
      this.analysisService = analysisService;
    }
    else if (repository) {
      this.analysisService = new FFprobeAnalysisService(repository);
    }
    else {
      this.analysisService = new FFprobeAnalysisService();
    }
  }

  /**
   * Convert MP4 to HLS with AES-128 encryption
   * New structure: stores HLS files directly in video UUID folder
   */
  async convertVideo(videoId: string, inputPath: string, encodingOptions?: EncodingOptions): Promise<void>;
  /**
   * Convert MP4 to HLS with enhanced encoding options (Phase 3)
   * Provides direct FFmpeg parameter control
   */
  async convertVideo(videoId: string, inputPath: string, enhancedOptions: EnhancedEncodingOptions): Promise<void>;
  async convertVideo(videoId: string, inputPath: string, options?: EncodingOptions | EnhancedEncodingOptions): Promise<void> {
    console.log(`🎬 Starting video conversion for video: ${videoId}`);

    const videoDir = join(config.paths.videos, videoId);
    await fs.mkdir(videoDir, { recursive: true });

    try {
      // 1. Analyze input video to determine optimal encoding settings
      console.log(`📊 Analyzing video: ${inputPath}`);
      const videoAnalysis = await this.analysisService.analyze(inputPath);
      console.log(`📊 Analysis: ${videoAnalysis.duration}s, ${videoAnalysis.bitrate}kbps, ${videoAnalysis.fileSize} bytes`);

      // 2. Generate AES-128 key for encryption
      const { keyInfoFile } = await this.keyManager.generateAndStoreVideoKey(videoId);

      // 3. Execute video conversion with encoding options
      const playlistPath = join(videoDir, 'playlist.m3u8');

      // Check if enhanced options are provided (Phase 3)
      if (options && 'codec' in options) {
        // Enhanced options path
        await this.executeVideoConversionEnhanced(inputPath, keyInfoFile, playlistPath, videoId, options, videoAnalysis);
      }
      else {
        // Legacy options path
        const legacyOptions = options || DEFAULT_ENCODING_OPTIONS;
        await this.executeVideoConversion(inputPath, keyInfoFile, playlistPath, videoId, legacyOptions, videoAnalysis);
      }

      // 4. Generate thumbnail after video conversion
      await this.generateVideoThumbnail(videoId, inputPath);

      // 5. Cleanup temporary files
      await this.keyManager.cleanupTempFiles(videoId);

      // 6. Remove original file to save storage
      await this.removeOriginalFile(inputPath);

      console.log(`✅ Video conversion completed for video: ${videoId}`);
    }
    catch (error) {
      console.error(`❌ Video conversion failed for video: ${videoId}`, error);
      await this.cleanup(videoId);
      throw error;
    }
  }

  /**
   * Execute video conversion with unified Shaka Packager workflow
   * All codecs use two-step process: FFmpeg → Shaka Packager
   * This ensures consistent DRM, folder structure, and audio/video separation
   */
  private async executeVideoConversion(
    inputPath: string,
    keyInfoFile: string,
    playlistPath: string,
    videoId: string,
    encodingOptions: EncodingOptions,
    videoAnalysis: VideoAnalysis,
  ): Promise<void> {
    console.log(`🎯 Using unified two-step workflow: FFmpeg → Shaka Packager for ${encodingOptions.encoder}`);
    await this.executeTwoStepConversion(inputPath, keyInfoFile, playlistPath, videoId, encodingOptions, videoAnalysis);
  }

  private async executeVideoConversionEnhanced(
    inputPath: string,
    keyInfoFile: string,
    playlistPath: string,
    videoId: string,
    enhancedOptions: EnhancedEncodingOptions,
    videoAnalysis: VideoAnalysis,
  ): Promise<void> {
    console.log(`🎯 Using enhanced two-step workflow: FFmpeg → Shaka Packager with ${enhancedOptions.codec}`);
    await this.executeTwoStepConversionEnhanced(inputPath, keyInfoFile, playlistPath, videoId, enhancedOptions, videoAnalysis);
  }

  /**
   * Two-step conversion process for HEVC content
   * Step 1: FFmpeg transcoding to intermediate MP4
   * Step 2: Shaka Packager for encrypted fMP4 DASH
   */
  private async executeTwoStepConversion(
    inputPath: string,
    keyInfoFile: string,
    playlistPath: string,
    videoId: string,
    encodingOptions: EncodingOptions,
    videoAnalysis: VideoAnalysis,
  ): Promise<void> {
    const videoDir = join(config.paths.videos, videoId);
    const intermediatePath = join(videoDir, 'intermediate.mp4');

    try {
      // Step 1: FFmpeg transcoding to intermediate MP4 (reuse existing logic)
      console.log(`📹 Step 1: FFmpeg transcoding to intermediate MP4...`);
      await this.executeFFmpegTranscoding(inputPath, intermediatePath, encodingOptions, videoAnalysis, videoId);

      // Step 2: Shaka Packager for encrypted fMP4 DASH
      console.log(`📦 Step 2: Shaka Packager encryption and DASH packaging...`);
      await this.executeShakaPackager(intermediatePath, videoDir, videoId, keyInfoFile);

      console.log(`✅ Two-step conversion completed for ${videoId}`);
    }
    catch (error) {
      console.error(`❌ Two-step conversion failed for ${videoId}:`, error);
      throw error;
    }
    finally {
      // Cleanup intermediate file
      try {
        await fs.unlink(intermediatePath);
        console.log(`🧹 Cleaned up intermediate file: ${intermediatePath}`);
      }
      catch {
        // Ignore cleanup errors for non-existent files
      }
    }
  }

  /**
   * Enhanced two-step conversion process (Phase 3)
   * Step 1: FFmpeg transcoding with enhanced options to intermediate MP4
   * Step 2: Shaka Packager for encrypted fMP4 DASH
   */
  private async executeTwoStepConversionEnhanced(
    inputPath: string,
    keyInfoFile: string,
    playlistPath: string,
    videoId: string,
    enhancedOptions: EnhancedEncodingOptions,
    videoAnalysis: VideoAnalysis,
  ): Promise<void> {
    const videoDir = join(config.paths.videos, videoId);
    const intermediatePath = join(videoDir, 'intermediate.mp4');

    try {
      // Step 1: FFmpeg transcoding with enhanced options
      console.log(`📹 Step 1: Enhanced FFmpeg transcoding to intermediate MP4...`);
      await this.executeFFmpegTranscodingEnhanced(inputPath, intermediatePath, enhancedOptions, videoAnalysis, videoId);

      // Step 2: Shaka Packager for encrypted fMP4 DASH (reuse existing logic)
      console.log(`📦 Step 2: Shaka Packager encryption and DASH packaging...`);
      await this.executeShakaPackager(intermediatePath, videoDir, videoId, keyInfoFile);

      console.log(`✅ Enhanced two-step conversion completed for ${videoId}`);
    }
    catch (error) {
      console.error(`❌ Enhanced two-step conversion failed for ${videoId}:`, error);
      throw error;
    }
    finally {
      // Cleanup intermediate file
      try {
        await fs.unlink(intermediatePath);
        console.log(`🧹 Cleaned up intermediate file: ${intermediatePath}`);
      }
      catch {
        // Ignore cleanup errors for non-existent files
      }
    }
  }

  /**
   * FFmpeg transcoding to intermediate MP4 (reusing existing encoding logic)
   * This preserves all the sophisticated encoding settings but outputs MP4 instead of HLS
   */
  private async executeFFmpegTranscoding(
    inputPath: string,
    outputPath: string,
    encodingOptions: EncodingOptions,
    videoAnalysis: VideoAnalysis,
    videoId: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Validate encoding options first
        validateEncodingOptionsStrict(encodingOptions);

        // Get validated encoding parameters (reuse existing logic)
        const codec = this.validateCodec(getCodecName(encodingOptions.encoder));
        const preset = this.validatePreset(getPresetValue(encodingOptions.encoder), encodingOptions.encoder);
        const qualityParam = this.validateQualityParam(getQualityParam(encodingOptions.encoder));
        const qualityValue = this.validateQualityValue(getQualityValue(encodingOptions.encoder));
        const additionalFlags = this.validateAdditionalFlags(getAdditionalFlags(encodingOptions.encoder));

        // Calculate target bitrate (reuse existing logic)
        const { targetVideoBitrate, audioSettings } = this.analysisService.calculateOptimalBitrates(videoAnalysis, encodingOptions.encoder);
        console.log(`🎯 Target video bitrate: ${targetVideoBitrate}k, Audio: ${audioSettings.codec} ${audioSettings.bitrate}`);

        // Build FFmpeg command for MP4 output (no HLS flags)
        const ffmpegArgs = [
          '-i',
          inputPath,

          // Video encoding with bitrate constraints (same as existing logic)
          '-c:v',
          codec,
          '-preset',
          preset,
        ];

        // Add quality and bitrate control based on encoder (same as existing logic)
        if (encodingOptions.encoder === 'cpu-h265') {
          ffmpegArgs.push(
            `-${qualityParam}`, qualityValue.toString(), '-maxrate', `${targetVideoBitrate}k`, '-bufsize', `${targetVideoBitrate * 2}k`,
          );
        }
        else if (encodingOptions.encoder === 'gpu-h265') {
          // GPU uses 2-pass encoding for optimal quality
          this.executeGPU2PassEncoding(
            inputPath,
            outputPath,
            videoId,
            targetVideoBitrate,
            audioSettings,
            preset,
          ).then(() => {
            console.log(`✅ GPU 2-pass transcoding completed for ${videoId}`);
            resolve();
          }).catch((error) => {
            reject(error);
          });
          return; // Skip single-pass execution
        }

        // Add additional encoding flags
        ffmpegArgs.push(...additionalFlags);

        // Add audio settings (same as existing logic)
        if (audioSettings.codec === 'copy') {
          ffmpegArgs.push('-c:a', 'copy');
        }
        else {
          ffmpegArgs.push(
            '-c:a', audioSettings.codec, '-b:a', audioSettings.bitrate, '-ac', '2', '-ar', '44100',
          );
        }

        // Add MP4 optimization flags
        ffmpegArgs.push('-movflags', '+faststart', outputPath);

        console.log(`⚙️  Encoding Settings: ${codec} ${qualityParam}=${qualityValue} preset=${preset}`);

        // UPDATED: Use VideoProcessingQueue for concurrency control
        executeFFmpegCommand({
          command: config.ffmpeg.ffmpegPath,
          args: ffmpegArgs,
          onStdout: (data) => {
            console.log(`FFmpeg stdout: ${data.toString()}`);
          },
          onStderr: (data) => {
            // Only log important progress information
            const output = data.toString();
            if (output.includes('frame=') || output.includes('time=')) {
              console.log(`FFmpeg progress: ${output.trim()}`);
            }
          },
        }).then(() => {
          console.log(`✅ FFmpeg transcoding completed`);
          resolve();
        }).catch((error) => {
          console.error(`❌ FFmpeg transcoding failed: ${error.message}`);
          reject(error);
        });
      }
      catch (error) {
        console.error(`❌ FFmpeg transcoding validation error:`, error);
        reject(error instanceof Error ? error : new Error('FFmpeg transcoding validation failed'));
      }
    });
  }

  /**
   * Enhanced FFmpeg transcoding to intermediate MP4 (Phase 3)
   * Uses direct FFmpeg parameter control from quality-mapping.ts
   */
  private async executeFFmpegTranscodingEnhanced(
    inputPath: string,
    outputPath: string,
    enhancedOptions: EnhancedEncodingOptions,
    videoAnalysis: VideoAnalysis,
    videoId: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🎯 Enhanced FFmpeg parameters - Codec: ${enhancedOptions.codec}, Preset: ${enhancedOptions.preset}, ${enhancedOptions.qualityParam}: ${enhancedOptions.qualityValue}`);
        console.log(`🎯 Target video bitrate: ${enhancedOptions.targetVideoBitrate}k, Audio: ${enhancedOptions.audioSettings.codec} ${enhancedOptions.audioSettings.bitrate}`);

        // Build FFmpeg command using enhanced options directly
        const ffmpegArgs = [
          '-i',
          inputPath,

          // Video encoding with enhanced parameters
          '-c:v',
          enhancedOptions.codec,
          '-preset',
          enhancedOptions.preset,
        ];

        // Add quality parameter (crf for CPU, cq for GPU)
        ffmpegArgs.push(`-${enhancedOptions.qualityParam}`, enhancedOptions.qualityValue.toString());

        // Add bitrate constraints
        ffmpegArgs.push('-maxrate', `${enhancedOptions.targetVideoBitrate}k`);
        ffmpegArgs.push('-bufsize', `${enhancedOptions.targetVideoBitrate * 2}k`);

        // Add additional optimization flags
        ffmpegArgs.push(...enhancedOptions.additionalFlags);

        // Audio encoding (reuse existing logic)
        if (enhancedOptions.audioSettings.codec === 'copy') {
          ffmpegArgs.push('-c:a', 'copy');
        }
        else {
          ffmpegArgs.push('-c:a', enhancedOptions.audioSettings.codec);
          if (enhancedOptions.audioSettings.bitrate) {
            ffmpegArgs.push('-b:a', enhancedOptions.audioSettings.bitrate);
          }
        }

        // Output format and optimizations
        ffmpegArgs.push('-f', 'mp4', '-movflags', '+faststart', '-y', outputPath);

        console.log(`🎬 Executing enhanced FFmpeg command for ${videoId}:`);
        console.log(`ffmpeg ${ffmpegArgs.join(' ')}`);

        // Execute FFmpeg with progress tracking
        executeFFmpegCommand({
          command: config.ffmpeg.ffmpegPath,
          args: ffmpegArgs,
          onProgress: (data: Buffer) => {
            const output = data.toString();
            if (output.includes('time=')) {
              console.log(`📊 Enhanced FFmpeg progress: ${output.trim()}`);
            }
          },
        }).then(() => {
          console.log(`✅ Enhanced FFmpeg transcoding completed for ${videoId}`);
          resolve();
        }).catch((error: any) => {
          console.error(`❌ Enhanced FFmpeg transcoding failed for ${videoId}:`, error);
          reject(error);
        });
      }
      catch (error) {
        console.error(`❌ Enhanced FFmpeg setup failed for ${videoId}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Shaka Packager for encrypted fMP4 DASH packaging
   * Reads existing AES key and creates encrypted fMP4 segments
   */
  private async executeShakaPackager(
    inputPath: string,
    outputDir: string,
    videoId: string,
    keyInfoFile: string,
  ): Promise<void> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve, reject) => {
      try {
        // Create video/ and audio/ subdirectories
        await fs.mkdir(join(outputDir, 'video'), { recursive: true });
        await fs.mkdir(join(outputDir, 'audio'), { recursive: true });
        console.log(`📁 Created video/ and audio/ subdirectories in ${outputDir}`);

        // Read the existing AES key from the key manager
        const key = await this.keyManager.getVideoKey(videoId);
        const keyHex = key.toString('hex');

        // Generate consistent Key ID from video ID (same as Clear Key license server)
        const keyId = this.generateKeyId(videoId);

        console.log(`🔑 Using AES-128 key for encryption (Key ID: ${keyId})`);
        console.log(`[PACKAGER] Using KEY for ${videoId}: ${keyHex}`);

        // Shaka Packager arguments for encrypted fMP4 DASH with separated video/audio
        const segmentDuration = process.env.HLS_SEGMENT_DURATION || '10';

        const packagerArgs = [
          // Video stream with encryption → video/ folder
          `in=${inputPath},stream=video,init_segment=${join(outputDir, 'video', 'init.mp4')},segment_template=${join(outputDir, 'video', 'segment-$Number%04d$.m4s')},drm_label=CENC`,

          // Audio stream with encryption → audio/ folder
          `in=${inputPath},stream=audio,init_segment=${join(outputDir, 'audio', 'init.mp4')},segment_template=${join(outputDir, 'audio', 'segment-$Number%04d$.m4s')},drm_label=CENC`,

          `--enable_raw_key_encryption`,
          `--protection_scheme`,
          `cenc`,
          // Shared encryption key for both video and audio streams
          `--keys`,
          `label=CENC:key_id=${keyId}:key=${keyHex}`,

          `--generate_static_live_mpd`,
          `--mpd_output`,
          join(outputDir, 'manifest.mpd'),
          `--segment_duration`,
          segmentDuration,
        ];

        // UPDATED: Use VideoProcessingQueue for Shaka Packager concurrency control
        executeFFmpegCommand({
          command: config.ffmpeg.shakaPackagerPath,
          args: packagerArgs,
          onStdout: (data) => {
            console.log(`Shaka Packager stdout: ${data.toString()}`);
          },
          onStderr: (data) => {
            console.log(`Shaka Packager stderr: ${data.toString()}`);
          },
        }).then(() => {
          console.log(`✅ Shaka Packager completed successfully`);
          resolve();
        }).catch((error) => {
          console.error(`❌ Shaka Packager failed: ${error.message}`);
          reject(error);
        });
      }
      catch (error) {
        console.error(`❌ Shaka Packager setup error:`, error);
        reject(error instanceof Error ? error : new Error('Shaka Packager setup failed'));
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
      '-tune',
      'fastdecode',
      'hq',
      'uhq',
      '-rc',
      'vbr',
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

      if (flagName === '-tune' && !['fastdecode', 'hq', 'uhq'].includes(flagValue)) {
        throw new Error(`Invalid tune value: ${flagValue}. Allowed values: fastdecode, hq, uhq`);
      }

      if (flagName === '-rc' && flagValue !== 'vbr') {
        throw new Error(`Invalid rc value: ${flagValue}. Allowed values: vbr`);
      }
    }

    return flags;
  }

  /**
   * Execute GPU 2-pass encoding for optimal video quality
   * Modified for two-step workflow: FFmpeg → Shaka Packager
   */
  private async executeGPU2PassEncoding(
    inputPath: string,
    outputPath: string,
    videoId: string,
    targetVideoBitrate: number,
    audioSettings: { codec: string; bitrate: string },
    preset: string,
  ): Promise<void> {
    const videoDir = join(config.paths.videos, videoId);
    const logFile = join(videoDir, 'ffmpeg2pass');

    console.log(`🎯 Starting GPU 2-pass encoding for ${videoId}`);

    try {
      // Pass 1: Analysis
      console.log(`📊 Pass 1: Analyzing video complexity...`);
      await this.executePass1(
        inputPath,
        targetVideoBitrate,
        preset,
        logFile,
      );

      // Pass 2: High-quality encoding to intermediate MP4
      console.log(`🎬 Pass 2: Encoding to intermediate MP4 with optimal bitrate distribution...`);
      await this.executePass2(
        inputPath,
        outputPath,
        targetVideoBitrate,
        audioSettings,
        preset,
        logFile,
      );

      console.log(`✅ GPU 2-pass encoding completed for ${videoId}`);
    }
    catch (error) {
      console.error(`❌ GPU 2-pass encoding failed for ${videoId}:`, error);
      throw error;
    }
    finally {
      // Cleanup log files
      await this.cleanupPassLogFiles(logFile);
    }
  }

  /**
   * Execute Pass 1: Video analysis for optimal bitrate distribution
   * UPDATED: Now uses VideoProcessingQueue for concurrency control
   */
  private async executePass1(
    inputPath: string,
    targetVideoBitrate: number,
    preset: string,
    logFile: string,
  ): Promise<void> {
    const pass1Args = [
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'hevc_nvenc',
      '-preset',
      preset,
      '-tune',
      'uhq',
      '-b:v',
      `${targetVideoBitrate}k`,
      '-maxrate',
      `${targetVideoBitrate}k`,
      '-bufsize',
      `${targetVideoBitrate * 2}k`,
      '-rc',
      'vbr',
      '-pass',
      '1',
      '-passlogfile',
      logFile,
      '-an', // No audio in pass 1
      '-f',
      'null',
      '/dev/null',
    ];

    try {
      await executeFFmpegCommand({
        command: config.ffmpeg.ffmpegPath,
        args: pass1Args,
        onStderr: (data) => {
          // Pass 1 stderr output (progress info) - no need to store, just pass through
          const output = data.toString();
          if (output.includes('frame=') || output.includes('time=')) {
            console.log(`Pass 1 progress: ${output.trim()}`);
          }
        },
      });

      console.log(`✅ Pass 1 analysis completed`);
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Pass 1 failed';
      console.error(`❌ Pass 1 failed: ${errorMessage}`);
      throw new Error(`Pass 1 failed: ${errorMessage}`);
    }
  }

  /**
   * Execute Pass 2: High-quality encoding to intermediate MP4
   * UPDATED: Now uses VideoProcessingQueue for concurrency control
   */
  private async executePass2(
    inputPath: string,
    outputPath: string,
    targetVideoBitrate: number,
    audioSettings: { codec: string; bitrate: string },
    preset: string,
    logFile: string,
  ): Promise<void> {
    const pass2Args = [
      '-y',
      '-i',
      inputPath,

      // Video encoding with Pass 1 analysis data
      '-c:v',
      'hevc_nvenc',
      '-preset',
      preset,
      '-tune',
      'uhq',
      '-b:v',
      `${targetVideoBitrate}k`,
      '-maxrate',
      `${targetVideoBitrate}k`,
      '-bufsize',
      `${targetVideoBitrate * 2}k`,
      '-rc',
      'vbr',
      '-pass',
      '2',
      '-passlogfile',
      logFile,
    ];

    // Add audio settings
    if (audioSettings.codec === 'copy') {
      pass2Args.push('-c:a', 'copy');
    }
    else {
      pass2Args.push(
        '-c:a', audioSettings.codec, '-b:a', audioSettings.bitrate, '-ac', '2', '-ar', '44100',
      );
    }

    // MP4 optimization for intermediate file
    pass2Args.push('-movflags', '+faststart', outputPath);

    try {
      await executeFFmpegCommand({
        command: config.ffmpeg.ffmpegPath,
        args: pass2Args,
        onStderr: (data) => {
          // Show encoding progress
          const output = data.toString();
          if (output.includes('frame=') || output.includes('time=')) {
            console.log(`FFmpeg progress: ${output.trim()}`);
          }
        },
      });

      console.log(`✅ Pass 2 MP4 encoding completed`);
    }
    catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Pass 2 failed';
      console.error(`❌ Pass 2 failed: ${errorMessage}`);
      throw new Error(`Pass 2 failed: ${errorMessage}`);
    }
  }

  /**
   * Clean up FFmpeg pass log files
   */
  private async cleanupPassLogFiles(logFilePrefix: string): Promise<void> {
    try {
      // FFmpeg creates log files with extensions like .log, .log.mbtree, etc.
      const logFiles = [
        `${logFilePrefix}-0.log`,
        `${logFilePrefix}-0.log.mbtree`,
        `${logFilePrefix}.log`,
        `${logFilePrefix}.log.mbtree`,
      ];

      for (const logFile of logFiles) {
        try {
          await fs.unlink(logFile);
          console.log(`🧹 Cleaned up log file: ${logFile}`);
        }
        catch {
          // Ignore cleanup errors for non-existent files
        }
      }
    }
    catch (error) {
      console.warn(`⚠️  Failed to cleanup pass log files:`, error);
    }
  }

  /**
   * Check if video conversion is available for video
   */
  async isVideoAvailable(videoId: string): Promise<boolean> {
    try {
      // Check for DASH manifest
      const manifestPath = join(config.paths.videos, videoId, 'manifest.mpd');

      await fs.access(manifestPath);
      return await this.keyManager.hasVideoKey(videoId);
    }
    catch {
      return false;
    }
  }

  /**
   * Get DASH manifest content
   */
  async getDashManifest(videoId: string): Promise<string> {
    const manifestPath = join(config.paths.videos, videoId, 'manifest.mpd');
    return await fs.readFile(manifestPath, 'utf-8');
  }

  /**
   * Generate consistent Key ID from video ID (used by both Shaka Packager and Clear Key license)
   */
  private generateKeyId(videoId: string): string {
    // Create deterministic key ID from video ID (16 bytes)
    const hash = createHash('sha256');
    hash.update(videoId);
    const digest = hash.digest();
    return digest.subarray(0, 16).toString('hex');
  }

  /**
   * Get list of HLS segments for a video
   */
  async getSegmentList(videoId: string): Promise<string[]> {
    try {
      const videoDir = join(config.paths.videos, videoId);
      const files = await fs.readdir(videoDir);
      return files.filter(file => file.endsWith('.m4s')).sort();
    }
    catch {
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
   * Validate segment path to prevent path traversal attacks
   * Now supports folder structure: video/init.mp4, video/segment-0001.m4s, audio/init.mp4, audio/segment-0001.m4s
   */
  isValidSegmentName(segmentPath: string): boolean {
    // Check for path traversal patterns (but allow single forward slash for folders)
    if (segmentPath.includes('..') || segmentPath.includes('\\') || segmentPath.startsWith('/') || segmentPath.endsWith('/')) {
      return false;
    }

    // Check for null bytes (security vulnerability)
    if (segmentPath.includes('\0')) {
      return false;
    }

    // Validate new folder structure: video/init.mp4, video/segment-0001.m4s, audio/init.mp4, audio/segment-0001.m4s
    return /^(video|audio)\/(init\.mp4|segment-\d{4}\.m4s)$/.test(segmentPath);
  }

  /**
   * Clean up HLS files for a video
   */
  async cleanup(videoId: string): Promise<void> {
    try {
      const videoDir = join(config.paths.videos, videoId);
      await fs.rm(videoDir, { recursive: true, force: true });
      console.log(`🧹 Cleaned up HLS files for video: ${videoId}`);
    }
    catch (error) {
      console.error(`⚠️  Failed to cleanup HLS files for ${videoId}:`, error);
    }
  }

  /**
   * Generate thumbnail for video after conversion
   */
  private async generateVideoThumbnail(videoId: string, inputPath: string): Promise<void> {
    try {
      const videoDir = join(config.paths.videos, videoId);
      const thumbnailPath = join(videoDir, 'thumbnail.jpg');

      console.log(`🎬 Generating thumbnail for video: ${videoId}`);
      const result = await generateSmartThumbnail(inputPath, thumbnailPath);

      if (result.success) {
        console.log(`✅ Thumbnail generated successfully for video: ${videoId}`);
      }
      else {
        console.error(`❌ Thumbnail generation failed for video: ${videoId}: ${result.error}`);
      }
    }
    catch (error) {
      console.error(`❌ Thumbnail generation error for video: ${videoId}:`, error);
    }
  }

  /**
   * Remove original file after successful video conversion
   */
  private async removeOriginalFile(originalPath: string): Promise<void> {
    try {
      await fs.unlink(originalPath);
      console.log(`🗑️  Removed original file: ${originalPath}`);
    }
    catch (error) {
      console.warn(`⚠️  Failed to remove original file ${originalPath}:`, error);
      // Don't throw error - conversion succeeded, original cleanup is non-critical
    }
  }
}
