import { join } from 'path';
import { config } from '~/configs';
import {
  InvalidVideoFileError,
  ResourceNotFoundError,
  TranscodingEngineError,
  UnsupportedVideoFormatError,
  VideoProcessingError,
} from '~/lib/errors';
import { Result } from '~/lib/result';
import { HLSConverter } from '~/services/hls-converter.server';
import type { EncodingOptions } from '../add-video/add-video.types';
import type { VideoAnalysisRepository } from '../analysis/repositories/video-analysis-repository.types';
import type { VideoAnalysisService } from '../analysis/video-analysis.types';
import type { TranscodeRequest, TranscodeResult, VideoMetadata, VideoTranscoder } from '../ports/VideoTranscoder';
import { FFprobeAnalysisService } from '../analysis/ffprobe-analysis.service';

/**
 * FFmpeg-based implementation of the VideoTranscoder port.
 * This adapter wraps the existing HLSConverter and provides a business-focused API.
 *
 * Phase 2 Implementation: This is a stub that wraps existing functionality
 * while providing the new interface. Full implementation will come in Phase 3.
 */
export class FFmpegVideoTranscoderAdapter implements VideoTranscoder {
  private hlsConverter: HLSConverter;
  private analysisService: VideoAnalysisService;

  constructor(
    analysisService?: VideoAnalysisService,
    repository?: VideoAnalysisRepository,
  ) {
    // Use dependency injection or create default services
    if (analysisService) {
      this.analysisService = analysisService;
    }
    else if (repository) {
      this.analysisService = new FFprobeAnalysisService(repository);
    }
    else {
      this.analysisService = new FFprobeAnalysisService();
    }

    this.hlsConverter = new HLSConverter(this.analysisService);
  }

  /**
   * Transcodes a video using business quality levels.
   * Maps business requests to technical HLSConverter calls.
   */
  async transcode(request: TranscodeRequest): Promise<Result<TranscodeResult, VideoProcessingError>> {
    try {
      // Validate input file exists
      const fileExists = await this.validateInputFile(request.sourcePath);
      if (!fileExists) {
        return Result.fail(new ResourceNotFoundError(`Source file: ${request.sourcePath}`));
      }

      // Map business quality to technical encoding options
      const encodingOptions = this.mapQualityToEncodingOptions(request.quality, request.useGpu);

      // Extract video metadata before processing
      const metadataResult = await this.extractMetadata(request.sourcePath);
      if (!metadataResult.success) {
        return Result.fail(metadataResult.error);
      }

      // Execute the existing HLSConverter (wrapped for error handling)
      await this.executeHLSConversion(request.videoId, request.sourcePath, encodingOptions);

      // Build result with processed file paths
      const result = await this.buildTranscodeResult(request.videoId, metadataResult.data);

      return Result.ok(result) as Result<TranscodeResult, VideoProcessingError>;
    }
    catch (error) {
      return this.handleTranscodingError(error);
    }
  }

  /**
   * Extracts metadata from a video file.
   */
  async extractMetadata(filePath: string): Promise<Result<VideoMetadata, VideoProcessingError>> {
    try {
      const analysis = await this.analysisService.analyze(filePath);

      const metadata: VideoMetadata = {
        duration: analysis.duration,
        bitrate: analysis.bitrate,
        videoCodec: analysis.videoCodec || 'unknown',
        audioCodec: analysis.audioCodec || 'unknown',
      };

      return Result.ok(metadata) as Result<VideoMetadata, VideoProcessingError>;
    }
    catch (error) {
      if (error instanceof Error) {
        return Result.fail(new InvalidVideoFileError(`Failed to extract metadata: ${error.message}`));
      }
      return Result.fail(new TranscodingEngineError('Unknown error during metadata extraction'));
    }
  }

  /**
   * Maps business quality levels to technical encoding options.
   * Phase 2: Simple mapping, will be enhanced in Phase 3.
   */
  private mapQualityToEncodingOptions(quality: 'high' | 'medium' | 'fast', useGpu: boolean): EncodingOptions {
    // For Phase 2, map to existing encoding options
    // Phase 3 will use the quality-mapping.ts strategy for full parameter control

    if (useGpu) {
      return { encoder: 'gpu-h265' };
    }
    else {
      return { encoder: 'cpu-h265' };
    }
  }

  /**
   * Validates that the input file exists and is accessible.
   */
  private async validateInputFile(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      await fs.access(filePath);
      return true;
    }
    catch {
      return false;
    }
  }

  /**
   * Executes the existing HLSConverter with error wrapping.
   */
  private async executeHLSConversion(
    videoId: string,
    sourcePath: string,
    encodingOptions: EncodingOptions,
  ): Promise<void> {
    try {
      await this.hlsConverter.convertVideo(videoId, sourcePath, encodingOptions);
    }
    catch (error) {
      // Re-throw with more context for the outer error handler
      if (error instanceof Error) {
        throw new Error(`HLS conversion failed: ${error.message}`);
      }
      throw new Error('HLS conversion failed with unknown error');
    }
  }

  /**
   * Builds the TranscodeResult from processed files.
   */
  private async buildTranscodeResult(videoId: string, metadata: VideoMetadata): Promise<TranscodeResult> {
    const videoDir = join(config.paths.videos, videoId);

    return {
      videoId,
      manifestPath: join(videoDir, 'manifest.mpd'), // Updated for DASH format
      thumbnailPath: join(videoDir, 'thumbnail.jpg'),
      duration: metadata.duration,
    };
  }

  /**
   * Handles and categorizes transcoding errors.
   */
  private handleTranscodingError(error: unknown): Result<TranscodeResult, VideoProcessingError> {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Categorize errors based on common patterns
      if (message.includes('unsupported') || message.includes('invalid format')) {
        return Result.fail(new UnsupportedVideoFormatError(error.message));
      }

      if (message.includes('not found') || message.includes('no such file')) {
        return Result.fail(new ResourceNotFoundError(error.message));
      }

      if (message.includes('timeout') || message.includes('killed')) {
        return Result.fail(new TranscodingEngineError(`Processing timeout: ${error.message}`));
      }

      // Default to engine error
      return Result.fail(new TranscodingEngineError(error.message));
    }

    return Result.fail(new TranscodingEngineError('Unknown transcoding error'));
  }
}
