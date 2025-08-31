import { Result } from '~/lib/result';
import type { EncodingOptions, EnhancedEncodingOptions } from '../../add-video/add-video.types';
import type {
  InsufficientResourcesError,
  TranscodingError,
  TranscodingFailedError,
  TranscodingQuality,
  TranscodingRequest,
  TranscodingResult,
  TranscodingSystemUnavailableError,
  UnsupportedVideoCodecError,
  VideoMetadata,
  VideoTranscodingPort,
} from '../../application/ports/video-transcoding.port';
import type { FFmpegTranscodingService } from '../../processing/types/ffmpeg-transcoding.types';
import type { TranscodingRequest as TechnicalTranscodingRequest } from '../../processing/types/ffmpeg-transcoding.types';
import {
  InsufficientResourcesError as PortInsufficientResourcesError,
  TranscodingFailedError as PortTranscodingFailedError,
  TranscodingSystemUnavailableError as PortTranscodingSystemUnavailableError,
  UnsupportedVideoCodecError as PortUnsupportedVideoCodecError,
} from '../../application/ports/video-transcoding.port';

/**
 * Adapter that implements the business-focused VideoTranscodingPort
 * by delegating to the technical FFmpegTranscodingService implementation.
 */
export class VideoTranscodingAdapter implements VideoTranscodingPort {
  constructor(
    private readonly transcodingService: FFmpegTranscodingService,
  ) {}

  /**
   * Transcode a video with business-level quality settings
   */
  async transcodeVideo(request: TranscodingRequest): Promise<Result<TranscodingResult, TranscodingError>> {
    try {
      // Check if transcoding system is available
      const isAvailable = await this.transcodingService.isAvailable();
      if (!isAvailable) {
        return Result.fail(new PortTranscodingSystemUnavailableError(request.videoId, 'FFmpeg not available'));
      }

      // Map business request to technical request
      const technicalRequest = this.mapToTechnicalRequest(request);

      // Execute transcoding
      const technicalResult = await this.transcodingService.transcode(technicalRequest);

      // Map technical result to business result
      const businessResult: TranscodingResult = {
        videoId: request.videoId,
        transcodedFilePath: technicalResult.outputPath,
        processingDurationSeconds: Math.round(technicalResult.duration / 1000),
        usedGpuAcceleration: technicalResult.usedGpu,
        outputFileSize: technicalResult.fileSize || 0,
        qualityMetrics: {
          videoBitrate: this.extractBitrateFromCodec(technicalResult.codec),
          audioBitrate: 128, // Standard audio bitrate
          videoCodec: technicalResult.codec,
          audioCodec: 'aac', // Standard audio codec
        },
      };

      return Result.ok(businessResult) as Result<TranscodingResult, TranscodingError>;
    }
    catch (error) {
      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Map technical errors to business errors
        if (message.includes('codec') && message.includes('not supported')) {
          return Result.fail(new PortUnsupportedVideoCodecError(request.videoId, 'unknown codec'));
        }

        if (message.includes('memory') || message.includes('space') || message.includes('resource')) {
          return Result.fail(new PortInsufficientResourcesError(request.videoId, 'system resources'));
        }

        return Result.fail(new PortTranscodingFailedError(request.videoId, error.message, request.inputPath));
      }

      return Result.fail(new PortTranscodingFailedError(request.videoId, 'Unknown error', request.inputPath));
    }
  }

  /**
   * Check if transcoding system is available and ready
   */
  async isTranscodingAvailable(): Promise<boolean> {
    try {
      return await this.transcodingService.isAvailable();
    }
    catch {
      return false;
    }
  }

  /**
   * Get estimated processing time for a video
   */
  async estimateProcessingTime(metadata: VideoMetadata, quality: TranscodingQuality): Promise<number> {
    // Estimation based on video characteristics and quality
    const pixelCount = metadata.width * metadata.height;
    const duration = metadata.duration;

    // Base processing time multiplier (real-time = 1.0)
    let multiplier = 1.0;

    // Adjust for quality
    switch (quality) {
      case 'fast':
        multiplier = 0.5;
        break;
      case 'medium':
        multiplier = 0.8;
        break;
      case 'high':
        multiplier = 1.5;
        break;
    }

    // Adjust for resolution
    if (pixelCount >= 8294400) { // 4K+
      multiplier *= 3.0;
    }
    else if (pixelCount >= 2073600) { // 1440p+
      multiplier *= 2.0;
    }
    else if (metadata.height >= 1080) {
      multiplier *= 1.5;
    }

    // Estimate: duration * complexity multiplier
    return Math.ceil(duration * multiplier);
  }

  /**
   * Map business request to technical request
   */
  private mapToTechnicalRequest(request: TranscodingRequest): TechnicalTranscodingRequest {
    // Create enhanced encoding options based on business parameters
    const enhancedOptions: EnhancedEncodingOptions = {
      codec: request.useGpuAcceleration ? 'h264_nvenc' : 'libx264',
      preset: this.getPresetForQuality(request.quality, request.useGpuAcceleration),
      qualityParam: request.useGpuAcceleration ? 'cq' : 'crf',
      qualityValue: this.getQualityValueForLevel(request.quality),
      additionalFlags: this.getAdditionalFlags(request.quality, request.useGpuAcceleration),
      targetVideoBitrate: Math.floor(request.videoMetadata.bitrate * 0.8), // Reduce by 20%
      audioSettings: this.getAudioSettings(request.audioHandling, request.videoMetadata),
    };

    const technicalVideoAnalysis = {
      duration: request.videoMetadata.duration,
      bitrate: request.videoMetadata.bitrate,
      audioBitrate: request.videoMetadata.audioBitrate,
      audioCodec: request.videoMetadata.audioCodec,
      videoCodec: request.videoMetadata.videoCodec,
      fileSize: request.videoMetadata.fileSize,
      width: request.videoMetadata.width,
      height: request.videoMetadata.height,
      frameRate: request.videoMetadata.frameRate,
    };

    return {
      inputPath: request.inputPath,
      outputPath: `${request.outputDir}/intermediate.mp4`,
      videoId: request.videoId,
      encodingOptions: enhancedOptions,
      videoAnalysis: technicalVideoAnalysis,
    };
  }

  /**
   * Get preset for quality level
   */
  private getPresetForQuality(quality: TranscodingQuality, useGpu: boolean): string {
    if (useGpu) {
      switch (quality) {
        case 'fast': return 'fast';
        case 'medium': return 'medium';
        case 'high': return 'slow';
      }
    }
    else {
      switch (quality) {
        case 'fast': return 'faster';
        case 'medium': return 'medium';
        case 'high': return 'slower';
      }
    }
  }

  /**
   * Get quality value for level
   */
  private getQualityValueForLevel(quality: TranscodingQuality): number {
    switch (quality) {
      case 'fast': return 28;
      case 'medium': return 23;
      case 'high': return 18;
    }
  }

  /**
   * Get additional flags
   */
  private getAdditionalFlags(quality: TranscodingQuality, useGpu: boolean): string[] {
    const flags = [];

    if (!useGpu && quality === 'high') {
      flags.push('-profile:v', 'high');
      flags.push('-level', '4.1');
    }

    return flags;
  }

  /**
   * Get audio settings based on handling preference
   */
  private getAudioSettings(audioHandling: string, metadata: VideoMetadata): { codec: string; bitrate: string } {
    switch (audioHandling) {
      case 'preserve':
        if (metadata.audioCodec === 'aac' && metadata.audioBitrate <= 160) {
          return { codec: 'copy', bitrate: '' };
        }
        break;
      case 'optimize':
        return { codec: 'aac', bitrate: '128k' };
      case 'standardize':
        return { codec: 'aac', bitrate: '128k' };
    }

    return { codec: 'aac', bitrate: '128k' };
  }

  /**
   * Extract bitrate from codec string (rough estimation)
   */
  private extractBitrateFromCodec(codec: string): number {
    // This is a rough estimation - in a real implementation,
    // you'd want to parse the actual output or track this during encoding
    return 2500; // Default estimate
  }
}
