import { promises as fs } from 'fs';
import path from 'path';
import type { EncodingOptions, EnhancedEncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { VideoAnalysis } from '~/modules/video/analysis/video-analysis.types';
import { config, ffmpeg } from '~/configs';
import { executeFFmpegCommand } from '~/lib/ffmpeg-process-manager';
import {
  getAdditionalFlags,
  getCodecName,
  getPresetValue,
  getQualityParam,
  getQualityValue,
} from '~/utils/encoding';
import type {
  CodecNotSupportedError,
  FFmpegCommandOptions,
  FFmpegTranscodingService,
  TranscodingError,
  TranscodingRequest,
  TranscodingResult,
} from '../types/ffmpeg-transcoding.types';
import { processExecutionService } from './ProcessExecutionService';

/**
 * Service responsible for video transcoding using FFmpeg
 */
export class FFmpegTranscodingServiceImpl implements FFmpegTranscodingService {
  /**
   * Transcode a video file with the specified options
   */
  async transcode(request: TranscodingRequest): Promise<TranscodingResult> {
    const { inputPath, outputPath, videoId, encodingOptions, videoAnalysis } = request;
    const startTime = Date.now();

    console.log(`🎬 [FFmpegTranscoding] Starting transcoding for video: ${videoId}`);
    console.log(`📊 [FFmpegTranscoding] Input: ${inputPath} -> Output: ${outputPath}`);

    // Check if enhanced options are provided
    const isEnhanced = 'codec' in encodingOptions;

    if (isEnhanced) {
      return this.transcodeWithEnhancedOptions(request);
    }
    else {
      return this.transcodeWithLegacyOptions(request);
    }
  }

  /**
   * Transcode with legacy encoding options
   */
  private async transcodeWithLegacyOptions(request: TranscodingRequest): Promise<TranscodingResult> {
    const { inputPath, outputPath, videoId, encodingOptions, videoAnalysis } = request;
    const options = encodingOptions as EncodingOptions;
    const startTime = Date.now();

    // Determine if GPU encoding and if 2-pass is needed
    const isGpuEncoding = 'encoder' in options ? options.encoder.startsWith('gpu-') : false;
    const needsTwoPass = false; // 2-pass only available for enhanced options

    if (needsTwoPass) {
      console.log(`🎯 [FFmpegTranscoding] Using 2-pass GPU encoding for high quality`);
      return this.transcodeTwoPass(request);
    }

    // Build FFmpeg command options
    const commandOptions = this.buildLegacyCommandOptions(inputPath, outputPath, options, videoAnalysis);
    const args = this.buildFFmpegArgs(commandOptions);

    // Execute FFmpeg
    await executeFFmpegCommand({
      command: 'ffmpeg',
      args,
      onProgress: (data) => {
        // Parse and log progress
        this.logFFmpegProgress(data.toString());
      },
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [FFmpegTranscoding] Transcoding completed in ${duration}ms`);

    // Get output file size
    const stats = await fs.stat(outputPath);

    return {
      outputPath,
      duration,
      usedGpu: isGpuEncoding,
      codec: getCodecName(options.encoder),
      fileSize: stats.size,
    };
  }

  /**
   * Transcode with enhanced encoding options
   */
  private async transcodeWithEnhancedOptions(request: TranscodingRequest): Promise<TranscodingResult> {
    const { inputPath, outputPath, videoId, encodingOptions, videoAnalysis } = request;
    const options = encodingOptions as EnhancedEncodingOptions;
    const startTime = Date.now();

    // Determine if GPU encoding and if 2-pass is needed
    const isGpuEncoding = options.codec.includes('nvenc') || options.codec.includes('vaapi');
    const needsTwoPass = isGpuEncoding && options.qualityValue <= 19;

    if (needsTwoPass) {
      console.log(`🎯 [FFmpegTranscoding] Using 2-pass GPU encoding for high quality`);
      return this.transcodeTwoPass(request);
    }

    // Build FFmpeg command options
    const commandOptions = this.buildEnhancedCommandOptions(inputPath, outputPath, options, videoAnalysis);
    const args = this.buildFFmpegArgs(commandOptions);

    // Execute FFmpeg
    await executeFFmpegCommand({
      command: 'ffmpeg',
      args,
      onProgress: (data) => {
        this.logFFmpegProgress(data.toString());
      },
    });

    const duration = Date.now() - startTime;
    console.log(`✅ [FFmpegTranscoding] Enhanced transcoding completed in ${duration}ms`);

    // Get output file size
    const stats = await fs.stat(outputPath);

    return {
      outputPath,
      duration,
      usedGpu: isGpuEncoding,
      codec: options.codec,
      fileSize: stats.size,
    };
  }

  /**
   * Execute two-pass encoding for better quality (GPU encoding)
   */
  async transcodeTwoPass(request: TranscodingRequest): Promise<TranscodingResult> {
    const { inputPath, outputPath, videoId, encodingOptions, videoAnalysis } = request;
    const startTime = Date.now();
    const passLogPrefix = `/tmp/ffmpeg-pass-${videoId}`;

    console.log(`🎬 [FFmpegTranscoding] Starting 2-pass GPU encoding for video: ${videoId}`);

    try {
      // Pass 1: Analysis pass
      console.log(`📊 [FFmpegTranscoding] Pass 1: Analyzing video...`);
      await this.executePass1(request, passLogPrefix);

      // Pass 2: Encoding pass
      console.log(`🎯 [FFmpegTranscoding] Pass 2: Encoding with optimized parameters...`);
      await this.executePass2(request, passLogPrefix);

      // Clean up pass log files
      await this.cleanupPassLogFiles(passLogPrefix);

      const duration = Date.now() - startTime;
      console.log(`✅ [FFmpegTranscoding] 2-pass encoding completed in ${duration}ms`);

      // Get output file size
      const stats = await fs.stat(outputPath);

      // Determine codec used
      const codec = 'codec' in encodingOptions
        ? (encodingOptions as EnhancedEncodingOptions).codec
        : getCodecName((encodingOptions as EncodingOptions).encoder);

      return {
        outputPath,
        duration,
        usedGpu: true,
        codec,
        fileSize: stats.size,
      };
    }
    catch (error) {
      // Clean up on error
      await this.cleanupPassLogFiles(passLogPrefix);
      throw error;
    }
  }

  /**
   * Execute first pass of 2-pass encoding
   */
  private async executePass1(request: TranscodingRequest, passLogPrefix: string): Promise<void> {
    const { inputPath, videoId, encodingOptions, videoAnalysis } = request;

    let commandOptions: FFmpegCommandOptions;
    if ('codec' in encodingOptions) {
      commandOptions = this.buildEnhancedCommandOptions(
        inputPath,
        '/dev/null', // Pass 1 doesn't produce output
        encodingOptions as EnhancedEncodingOptions,
        videoAnalysis,
      );
    }
    else {
      commandOptions = this.buildLegacyCommandOptions(
        inputPath,
        '/dev/null',
        encodingOptions as EncodingOptions,
        videoAnalysis,
      );
    }

    // Set pass-specific options
    commandOptions.passNumber = 1;
    commandOptions.passLogPrefix = passLogPrefix;

    const args = this.buildFFmpegArgs(commandOptions);

    await executeFFmpegCommand({
      args,
      command: 'ffmpeg',
      onProgress: (data) => {
        this.logFFmpegProgress(data.toString(), 'Pass 1');
      },
    });
  }

  /**
   * Execute second pass of 2-pass encoding
   */
  private async executePass2(request: TranscodingRequest, passLogPrefix: string): Promise<void> {
    const { inputPath, outputPath, videoId, encodingOptions, videoAnalysis } = request;

    let commandOptions: FFmpegCommandOptions;
    if ('codec' in encodingOptions) {
      commandOptions = this.buildEnhancedCommandOptions(
        inputPath,
        outputPath,
        encodingOptions as EnhancedEncodingOptions,
        videoAnalysis,
      );
    }
    else {
      commandOptions = this.buildLegacyCommandOptions(
        inputPath,
        outputPath,
        encodingOptions as EncodingOptions,
        videoAnalysis,
      );
    }

    // Set pass-specific options
    commandOptions.passNumber = 2;
    commandOptions.passLogPrefix = passLogPrefix;

    const args = this.buildFFmpegArgs(commandOptions);

    await executeFFmpegCommand({
      args,
      command: 'ffmpeg',
      onProgress: (data) => {
        this.logFFmpegProgress(data.toString(), 'Pass 2');
      },
    });
  }

  /**
   * Build command options from legacy encoding options
   */
  private buildLegacyCommandOptions(
    input: string,
    output: string,
    options: EncodingOptions,
    analysis: VideoAnalysis,
  ): FFmpegCommandOptions {
    const codec = getCodecName(options.encoder);
    const preset = getPresetValue(options.encoder);
    const qualityParam = getQualityParam(options.encoder);
    const qualityValue = getQualityValue(options.encoder);
    const additionalFlags = getAdditionalFlags(options.encoder);

    // Calculate bitrates
    const { targetVideoBitrate, maxVideoBitrate, bufferSize } =
      this.calculateBitrates(analysis, options.encoder);

    return {
      input,
      output,
      videoCodec: codec,
      qualityParam,
      qualityValue,
      preset,
      videoBitrate: targetVideoBitrate,
      maxVideoBitrate,
      bufferSize,
      audioCodec: 'aac',
      audioBitrate: '128k',
      audioChannels: 2,
      audioSampleRate: 44100,
      additionalFlags,
      hwAccel: options.encoder.startsWith('gpu-'),
    };
  }

  /**
   * Build command options from enhanced encoding options
   */
  private buildEnhancedCommandOptions(
    input: string,
    output: string,
    options: EnhancedEncodingOptions,
    analysis: VideoAnalysis,
  ): FFmpegCommandOptions {
    return {
      input,
      output,
      videoCodec: options.codec,
      qualityParam: options.qualityParam,
      qualityValue: options.qualityValue,
      preset: options.preset,
      videoBitrate: options.targetVideoBitrate ? `${options.targetVideoBitrate}k` : undefined,
      maxVideoBitrate: options.targetVideoBitrate ? `${Math.round(options.targetVideoBitrate * 1.5)}k` : undefined,
      bufferSize: options.targetVideoBitrate ? `${options.targetVideoBitrate * 2}k` : undefined,
      audioCodec: options.audioSettings?.codec || 'aac',
      audioBitrate: options.audioSettings?.bitrate || '128k',
      audioChannels: 2, // Default audio channels
      audioSampleRate: 44100, // Default audio sample rate
      additionalFlags: options.additionalFlags,
      hwAccel: options.codec.includes('nvenc') || options.codec.includes('vaapi'),
    };
  }

  /**
   * Build FFmpeg command arguments from options
   */
  buildFFmpegArgs(options: FFmpegCommandOptions): string[] {
    const args: string[] = [];

    // Input file
    args.push('-i', options.input);

    // Video codec
    args.push('-c:v', options.videoCodec);

    // Quality settings
    if (options.qualityParam && options.qualityValue !== undefined) {
      args.push(`-${options.qualityParam}`, options.qualityValue.toString());
    }

    // Preset
    if (options.preset) {
      args.push('-preset', options.preset);
    }

    // Bitrate settings
    if (options.videoBitrate) {
      args.push('-b:v', options.videoBitrate);
    }
    if (options.maxVideoBitrate) {
      args.push('-maxrate', options.maxVideoBitrate);
    }
    if (options.bufferSize) {
      args.push('-bufsize', options.bufferSize);
    }

    // Audio settings
    if (options.audioCodec) {
      args.push('-c:a', options.audioCodec);
    }
    if (options.audioBitrate) {
      args.push('-b:a', options.audioBitrate);
    }
    if (options.audioChannels) {
      args.push('-ac', options.audioChannels.toString());
    }
    if (options.audioSampleRate) {
      args.push('-ar', options.audioSampleRate.toString());
    }

    // Additional flags
    if (options.additionalFlags && options.additionalFlags.length > 0) {
      args.push(...options.additionalFlags);
    }

    // Two-pass encoding flags
    if (options.passNumber) {
      args.push('-pass', options.passNumber.toString());
      if (options.passLogPrefix) {
        args.push('-passlogfile', options.passLogPrefix);
      }
    }

    // Output format
    args.push('-f', 'mp4');

    // Fast start for streaming
    args.push('-movflags', '+faststart');

    // Overwrite output file
    args.push('-y');

    // Output file
    args.push(options.output);

    return args;
  }

  /**
   * Check if FFmpeg is available
   */
  async isAvailable(): Promise<boolean> {
    return processExecutionService.isCommandAvailable('ffmpeg');
  }

  /**
   * Get FFmpeg version information
   */
  async getVersion(): Promise<string> {
    const result = await processExecutionService.execute({
      command: 'ffmpeg',
      args: ['-version'],
      captureStdout: true,
    });

    return result.stdout || 'Unknown';
  }

  /**
   * Calculate bitrates based on video analysis
   */
  private calculateBitrates(analysis: VideoAnalysis, encoder: string) {
    // Simple bitrate calculation based on resolution
    // This can be enhanced with more sophisticated logic
    const pixels = analysis.width * analysis.height;

    let targetBitrate = '2000k';
    if (pixels > 3840 * 2160) { // 4K+
      targetBitrate = '15000k';
    }
    else if (pixels > 1920 * 1080) { // >1080p
      targetBitrate = '8000k';
    }
    else if (pixels > 1280 * 720) { // >720p
      targetBitrate = '5000k';
    }
    else if (pixels > 854 * 480) { // >480p
      targetBitrate = '2500k';
    }

    // GPU encoding typically uses higher bitrates
    if (encoder.startsWith('gpu-')) {
      const bitrateValue = parseInt(targetBitrate);
      targetBitrate = `${Math.floor(bitrateValue * 1.2)}k`;
    }

    return {
      targetVideoBitrate: targetBitrate,
      maxVideoBitrate: `${parseInt(targetBitrate) * 1.5}k`,
      bufferSize: `${parseInt(targetBitrate) * 2}k`,
    };
  }

  /**
   * Clean up pass log files from 2-pass encoding
   */
  private async cleanupPassLogFiles(passLogPrefix: string): Promise<void> {
    try {
      await fs.unlink(`${passLogPrefix}-0.log`);
      await fs.unlink(`${passLogPrefix}-0.log.mbtree`);
      console.log(`🧹 [FFmpegTranscoding] Cleaned up pass log files`);
    }
    catch {
      // Ignore cleanup errors
    }
  }

  /**
   * Log FFmpeg progress
   */
  private logFFmpegProgress(line: string, passLabel?: string) {
    const prefix = passLabel ? `[${passLabel}]` : '';

    // Parse frame, fps, and speed from FFmpeg output
    const frameMatch = line.match(/frame=\s*(\d+)/);
    const fpsMatch = line.match(/fps=\s*([\d.]+)/);
    const speedMatch = line.match(/speed=\s*([\d.]+)x/);

    if (frameMatch || fpsMatch || speedMatch) {
      const parts = [];
      if (frameMatch) parts.push(`Frame: ${frameMatch[1]}`);
      if (fpsMatch) parts.push(`FPS: ${fpsMatch[1]}`);
      if (speedMatch) parts.push(`Speed: ${speedMatch[1]}x`);

      console.log(`📊 [FFmpegTranscoding] ${prefix} ${parts.join(' | ')}`);
    }
  }
}

// Export singleton instance
export const ffmpegTranscodingService = new FFmpegTranscodingServiceImpl();
