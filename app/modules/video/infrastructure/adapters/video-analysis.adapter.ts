import { promises as fs } from 'fs';
import { Result } from '~/lib/result';
import type { VideoAnalysisService } from '../../analysis/video-analysis.types';
import type {
  EncodingRecommendation,
  UnsupportedVideoFormatError,
  VideoAnalysisError,
  VideoAnalysisFailedError,
  VideoAnalysisPort,
  VideoFileNotFoundError,
  VideoMetadata,
} from '../../application/ports/video-analysis.port';
import {
  UnsupportedVideoFormatError as PortUnsupportedVideoFormatError,
  VideoAnalysisFailedError as PortVideoAnalysisFailedError,
  VideoFileNotFoundError as PortVideoFileNotFoundError,
} from '../../application/ports/video-analysis.port';

/**
 * Adapter that implements the business-focused VideoAnalysisPort
 * by delegating to the technical VideoAnalysisService implementation.
 */
export class VideoAnalysisAdapter implements VideoAnalysisPort {
  constructor(
    private readonly analysisService: VideoAnalysisService,
  ) {}

  /**
   * Analyze a video file to extract technical metadata
   */
  async analyzeVideo(filePath: string): Promise<Result<VideoMetadata, VideoAnalysisError>> {
    try {
      // Check if file exists first
      await fs.access(filePath);

      // Analyze the video using the technical service
      const analysis = await this.analysisService.analyze(filePath);

      // Convert to business-focused metadata
      const metadata: VideoMetadata = {
        duration: analysis.duration,
        bitrate: analysis.bitrate,
        audioBitrate: analysis.audioBitrate,
        videoCodec: analysis.videoCodec,
        audioCodec: analysis.audioCodec,
        fileSize: analysis.fileSize,
        width: analysis.width,
        height: analysis.height,
        frameRate: analysis.frameRate,
        resolution: this.formatResolution(analysis.width, analysis.height),
        qualityLevel: this.assessQualityLevel(analysis.width, analysis.height, analysis.bitrate),
      };

      return Result.ok(metadata) as Result<VideoMetadata, VideoAnalysisError>;
    }
    catch (error) {
      if (error instanceof Error) {
        // Check if file not found
        if ((error as any).code === 'ENOENT') {
          return Result.fail(new PortVideoFileNotFoundError(filePath));
        }

        // Check for unsupported format errors
        const message = error.message.toLowerCase();
        if (message.includes('unsupported') || message.includes('invalid format') || message.includes('codec')) {
          return Result.fail(new PortUnsupportedVideoFormatError(filePath));
        }

        // General analysis failure
        return Result.fail(new PortVideoAnalysisFailedError(filePath, error.message));
      }

      return Result.fail(new PortVideoAnalysisFailedError(filePath, 'Unknown error'));
    }
  }

  /**
   * Calculate optimal encoding settings for a video
   */
  async recommendEncodingSettings(
    metadata: VideoMetadata,
    targetQuality: 'high' | 'medium' | 'fast',
    useGpu: boolean,
  ): Promise<Result<EncodingRecommendation, VideoAnalysisError>> {
    try {
      // Convert business metadata back to technical format for calculation
      const technicalAnalysis = {
        duration: metadata.duration,
        bitrate: metadata.bitrate,
        audioBitrate: metadata.audioBitrate,
        videoCodec: metadata.videoCodec,
        audioCodec: metadata.audioCodec,
        fileSize: metadata.fileSize,
        width: metadata.width,
        height: metadata.height,
        frameRate: metadata.frameRate,
      };

      // Use the encoder mapping based on GPU preference
      const encoder = useGpu ? 'gpu-h265' : 'cpu-h265';
      const bitrateCalc = this.analysisService.calculateOptimalBitrates(technicalAnalysis, encoder);

      // Create business-focused recommendation
      const recommendation: EncodingRecommendation = {
        targetVideoBitrate: bitrateCalc.targetVideoBitrate,
        audioSettings: {
          codec: bitrateCalc.audioSettings.codec === 'copy' ? 'copy' : 'aac',
          bitrate: bitrateCalc.audioSettings.bitrate,
        },
        requiresTranscoding: this.requiresTranscoding(metadata, targetQuality),
        processingComplexity: this.assessProcessingComplexity(metadata, targetQuality, useGpu),
        estimatedOutputSize: this.estimateOutputSize(metadata, bitrateCalc.targetVideoBitrate),
      };

      return Result.ok(recommendation) as Result<EncodingRecommendation, VideoAnalysisError>;
    }
    catch (error) {
      if (error instanceof Error) {
        return Result.fail(new PortVideoAnalysisFailedError('encoding-recommendation', error.message));
      }
      return Result.fail(new PortVideoAnalysisFailedError('encoding-recommendation', 'Unknown error'));
    }
  }

  /**
   * Format resolution as a readable string
   */
  private formatResolution(width: number, height: number): string {
    if (width === 0 || height === 0) {
      return 'unknown';
    }
    return `${width}x${height}`;
  }

  /**
   * Assess quality level based on resolution and bitrate
   */
  private assessQualityLevel(width: number, height: number, bitrate: number): 'high' | 'medium' | 'low' {
    const pixelCount = width * height;

    // High quality criteria
    if (height >= 1080 && bitrate >= 5000) {
      return 'high';
    }
    if (pixelCount >= 2073600 && bitrate >= 3000) { // ~1440p
      return 'high';
    }

    // Low quality criteria
    if (height < 720 || bitrate < 2000) {
      return 'low';
    }

    // Everything else is medium
    return 'medium';
  }

  /**
   * Determine if transcoding is required
   */
  private requiresTranscoding(metadata: VideoMetadata, targetQuality: 'high' | 'medium' | 'fast'): boolean {
    // Always require transcoding for security (AES encryption)
    // and format standardization (DASH packaging)
    return true;
  }

  /**
   * Assess processing complexity
   */
  private assessProcessingComplexity(
    metadata: VideoMetadata,
    targetQuality: 'high' | 'medium' | 'fast',
    useGpu: boolean,
  ): 'low' | 'medium' | 'high' {
    const pixelCount = metadata.width * metadata.height;
    const durationFactor = Math.min(metadata.duration / 3600, 2); // Cap at 2 hours for calculation

    // Base complexity on resolution
    let complexity: 'low' | 'medium' | 'high' = 'low';

    if (pixelCount >= 8294400) { // 4K+
      complexity = 'high';
    }
    else if (pixelCount >= 2073600) { // 1440p+
      complexity = 'medium';
    }
    else if (metadata.height >= 1080) {
      complexity = 'medium';
    }

    // Adjust for quality settings
    if (targetQuality === 'high') {
      complexity = complexity === 'low' ? 'medium' : 'high';
    }
    else if (targetQuality === 'fast') {
      complexity = complexity === 'high' ? 'medium' : 'low';
    }

    // GPU reduces complexity
    if (useGpu && complexity === 'high') {
      complexity = 'medium';
    }

    return complexity;
  }

  /**
   * Estimate output file size
   */
  private estimateOutputSize(metadata: VideoMetadata, targetVideoBitrate: number): number {
    // Estimate based on target bitrate and duration
    // Add 20% overhead for container, segmentation, and metadata
    const estimatedBitrate = targetVideoBitrate + 128; // Add audio bitrate
    const bytesPerSecond = (estimatedBitrate * 1000) / 8; // Convert kbps to bytes/sec
    const baseSize = bytesPerSecond * metadata.duration;
    return Math.floor(baseSize * 1.2); // 20% overhead
  }
}
