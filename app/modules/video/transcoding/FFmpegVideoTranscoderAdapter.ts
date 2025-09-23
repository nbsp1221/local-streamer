import { join } from 'path';
import { config } from '~/configs';
import { getFFmpegPath } from '~/configs/ffmpeg';
import {
  InvalidVideoFileError,
  ResourceNotFoundError,
  TranscodingEngineError,
  UnsupportedVideoFormatError,
  VideoProcessingError,
} from '~/lib/errors';
import { Result } from '~/lib/result';
import type { EncodingOptions, EnhancedEncodingOptions } from '../add-video/add-video.types';
import type { VideoAnalysisRepository } from '../analysis/repositories/video-analysis-repository.types';
import type { VideoAnalysisService } from '../analysis/video-analysis.types';
import type { OrchestrationRequest, OrchestrationResult } from '../processing/types/transcoding-orchestrator.types';
import { FFmpegThumbnailAdapter } from '../../thumbnail/infrastructure/adapters/ffmpeg-thumbnail.adapter';
import { FFprobeAnalysisService } from '../analysis/ffprobe-analysis.service';
import { processExecutionService } from '../processing/services/ProcessExecutionService';
import { TranscodingOrchestratorServiceImpl } from '../processing/services/TranscodingOrchestratorService';
import { ProcessExecutionError } from '../processing/types/process-execution.types';
import { Pbkdf2KeyManagerAdapter } from '../security/adapters/pbkdf2-key-manager.adapter';
import type { TranscodeRequest, TranscodeResult, VideoMetadata, VideoTranscoder } from './VideoTranscoder';
import { getCodecForEncoder, getQualityParamName, getQualitySettings } from './quality-mapping';

/**
 * FFmpeg-based implementation of the VideoTranscoder port.
 * This adapter uses the new modular transcoding orchestrator services.
 *
 * Phase 3 Implementation: Now uses distributed services instead of monolithic HLSConverter.
 */
export class FFmpegVideoTranscoderAdapter implements VideoTranscoder {
  private analysisService: VideoAnalysisService;
  private transcodingOrchestratorService: TranscodingOrchestratorServiceImpl;
  private hardwareEncoderAvailability: Map<string, {
    available: boolean;
    reason?: string;
  }> = new Map();

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

    // Create transcoding orchestrator service with dependencies
    const keyManager = new Pbkdf2KeyManagerAdapter();
    const thumbnailGenerator = new FFmpegThumbnailAdapter();
    this.transcodingOrchestratorService = new TranscodingOrchestratorServiceImpl({
      keyManager,
      thumbnailGenerator,
    });
  }

  /**
   * Transcodes a video using business quality levels.
   * Maps business requests to orchestrated transcoding services.
   */
  async transcode(request: TranscodeRequest): Promise<Result<TranscodeResult, VideoProcessingError>> {
    try {
      // Validate input file exists
      const fileExists = await this.validateInputFile(request.sourcePath);
      if (!fileExists) {
        return Result.fail(new ResourceNotFoundError(`Source file: ${request.sourcePath}`));
      }

      // Check whether requested GPU encoders are actually available.
      const {
        options: enhancedOptions,
        useGpu,
      } = await this.resolveEncodingOptions(request);

      // Extract video metadata before processing
      const metadataResult = await this.extractMetadata(request.sourcePath);
      if (!metadataResult.success) {
        return Result.fail(metadataResult.error);
      }

      // Execute orchestrated transcoding workflow
      const orchestrationResult = await this.executeOrchestration(request, enhancedOptions, metadataResult.data);

      // Build result from orchestration output
      const result = await this.buildTranscodeResultFromOrchestration(orchestrationResult, metadataResult.data);

      return Result.ok(result) as Result<TranscodeResult, VideoProcessingError>;
    }
    catch (error) {
      return this.handleTranscodingError(error);
    }
  }

  /**
   * Resolves encoding options. If GPU encoding is requested but unavailable, throw immediately.
   */
  private async resolveEncodingOptions(
    request: TranscodeRequest,
  ): Promise<{ options: EnhancedEncodingOptions; useGpu: boolean }> {
    const useGpu = request.useGpu;

    if (useGpu) {
      const gpuCodec = getCodecForEncoder(true);
      const availability = await this.isHardwareCodecAvailable(gpuCodec, request.videoId);
      if (!availability.available) {
        const reason = availability.reason?.trim();
        throw new TranscodingEngineError(
          reason
            ? `Hardware encoder ${gpuCodec} unavailable for video ${request.videoId}: ${reason}`
            : `Hardware encoder ${gpuCodec} unavailable for video ${request.videoId}.`,
        );
      }
    }

    const options = await this.createEnhancedEncodingOptions(request.quality, useGpu, request.sourcePath);
    return { options, useGpu };
  }

  /**
   * Checks whether the requested hardware encoder is actually usable in the current environment.
   */
  private async isHardwareCodecAvailable(codec: string, videoId: string): Promise<{
    available: boolean;
    reason?: string;
  }> {
    const isHardwareCodec = codec.includes('nvenc') || codec.includes('vaapi');
    if (!isHardwareCodec) {
      return { available: true };
    }

    if (this.hardwareEncoderAvailability.has(codec)) {
      return this.hardwareEncoderAvailability.get(codec)!;
    }

    const probeResolution = this.getHardwareProbeResolution(codec);
    const args = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      `color=c=black:s=${probeResolution}:d=1`,
      '-frames:v',
      '1',
      '-c:v',
      codec,
      '-f',
      'null',
      '-',
    ];

    try {
      await processExecutionService.execute({
        command: getFFmpegPath(),
        args,
        captureStderr: true,
        captureStdout: false,
        timeout: 5000,
        label: `probe-${codec}`,
      });

      const availability = { available: true } as const;
      this.hardwareEncoderAvailability.set(codec, availability);
      return availability;
    }
    catch (error) {
      const reason = error instanceof ProcessExecutionError
        ? (error.stderr || error.message)
        : error instanceof Error ? error.message : 'unknown error';

      console.warn(
        `[FFmpegVideoTranscoderAdapter] Hardware encoder ${codec} unavailable (video ${videoId}): ${reason?.trim() || 'no details'}.`,
      );

      const availability = {
        available: false,
        reason,
      } as const;
      this.hardwareEncoderAvailability.set(codec, availability);
      return availability;
    }
  }

  /**
   * Returns a conservative resolution that satisfies the minimum NVENC requirements.
   * Ampere+ GPUs require at least ~129x33 for HEVC and ~145x33 for H.264, so we probe at 256x256.
   */
  private getHardwareProbeResolution(codec: string): string {
    if (codec.includes('hevc') || codec.includes('av1')) {
      return '256x256';
    }

    if (codec.includes('h264') || codec.includes('avc')) {
      return '256x256';
    }

    // Default to a square resolution safely above known minimums.
    return '256x256';
  }

  /**
   * Extracts metadata from a video file.
   */
  async extractMetadata(filePath: string): Promise<Result<VideoMetadata, VideoProcessingError>> {
    try {
      const analysis = await this.analysisService.analyze(filePath);

      const metadata: VideoMetadata = {
        // Basic metadata
        duration: analysis.duration,
        bitrate: analysis.bitrate,
        videoCodec: analysis.videoCodec || 'unknown',
        audioCodec: analysis.audioCodec || 'unknown',

        // Enhanced metadata
        width: analysis.width,
        height: analysis.height,
        frameRate: analysis.frameRate,
        fileSize: analysis.fileSize,

        // Business-friendly format information
        resolution: this.formatResolution(analysis.width, analysis.height),
        formatDescription: this.createFormatDescription(analysis.videoCodec, analysis.width, analysis.height),
        recommendedQuality: this.recommendQuality(analysis.width, analysis.height, analysis.bitrate),
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
   * Creates enhanced encoding options using quality-mapping.ts strategy (Phase 3).
   * This replaces the Phase 2 stub and provides direct FFmpeg parameter control.
   */
  private async createEnhancedEncodingOptions(
    quality: 'high' | 'medium' | 'fast',
    useGpu: boolean,
    sourcePath: string,
  ): Promise<EnhancedEncodingOptions> {
    // Extract video analysis for bitrate calculation
    const analysis = await this.analysisService.analyze(sourcePath);

    // Get quality settings from quality-mapping.ts
    const qualitySettings = getQualitySettings(quality, useGpu);
    const codec = getCodecForEncoder(useGpu);
    const qualityParam = getQualityParamName(useGpu);

    // Calculate optimal bitrates using existing logic
    const legacyEncoder = useGpu ? 'gpu-h265' : 'cpu-h265';
    const bitrateCalc = this.analysisService.calculateOptimalBitrates(analysis, legacyEncoder);

    return {
      codec,
      preset: qualitySettings.preset,
      qualityParam,
      qualityValue: qualitySettings.qualityValue,
      additionalFlags: qualitySettings.additionalFlags,
      targetVideoBitrate: bitrateCalc.targetVideoBitrate,
      audioSettings: bitrateCalc.audioSettings,
    };
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
   * Executes the orchestrated transcoding workflow (Phase 3).
   */
  private async executeOrchestration(
    request: TranscodeRequest,
    enhancedOptions: EnhancedEncodingOptions,
    metadata: VideoMetadata,
  ): Promise<OrchestrationResult> {
    const orchestrationRequest: OrchestrationRequest = {
      videoId: request.videoId,
      inputPath: request.sourcePath,
      encodingOptions: enhancedOptions,
      videoAnalysis: {
        duration: metadata.duration,
        bitrate: metadata.bitrate,
        audioBitrate: 128000, // Default audio bitrate
        width: metadata.width,
        height: metadata.height,
        frameRate: metadata.frameRate,
        fileSize: metadata.fileSize,
        videoCodec: metadata.videoCodec,
        audioCodec: metadata.audioCodec,
      },
      generateThumbnail: true,
      cleanupOriginal: false,
    };

    return this.transcodingOrchestratorService.execute(orchestrationRequest);
  }

  /**
   * Builds the TranscodeResult from orchestration result.
   */
  private async buildTranscodeResultFromOrchestration(
    orchestrationResult: OrchestrationResult,
    metadata: VideoMetadata,
  ): Promise<TranscodeResult> {
    return {
      videoId: orchestrationResult.videoId,
      manifestPath: orchestrationResult.manifestPath,
      thumbnailPath: orchestrationResult.thumbnailPath || join(config.paths.videos, orchestrationResult.videoId, 'thumbnail.jpg'),
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

  /**
   * Format resolution as a readable string.
   */
  private formatResolution(width: number, height: number): string {
    if (width === 0 || height === 0) {
      return 'unknown';
    }
    return `${width}x${height}`;
  }

  /**
   * Create a business-friendly format description.
   */
  private createFormatDescription(videoCodec: string, width: number, height: number): string {
    // Determine resolution category
    let resolutionLabel = '';
    if (height >= 2160) {
      resolutionLabel = '4K';
    }
    else if (height >= 1440) {
      resolutionLabel = '2K';
    }
    else if (height >= 1080) {
      resolutionLabel = 'Full HD';
    }
    else if (height >= 720) {
      resolutionLabel = 'HD';
    }
    else if (height >= 480) {
      resolutionLabel = 'SD';
    }
    else {
      resolutionLabel = 'Low Res';
    }

    // Format codec name
    let codecLabel = '';
    switch (videoCodec.toLowerCase()) {
      case 'h264':
      case 'avc':
        codecLabel = 'H.264';
        break;
      case 'h265':
      case 'hevc':
        codecLabel = 'H.265';
        break;
      case 'vp9':
        codecLabel = 'VP9';
        break;
      case 'av1':
        codecLabel = 'AV1';
        break;
      default:
        codecLabel = videoCodec.toUpperCase();
    }

    return `${resolutionLabel} ${codecLabel}`;
  }

  /**
   * Recommend encoding quality based on video characteristics.
   */
  private recommendQuality(width: number, height: number, bitrate: number): 'high' | 'medium' | 'fast' {
    const pixelCount = width * height;

    // High quality recommendation for:
    // - 4K+ content regardless of bitrate
    // - High bitrate content (>8000 kbps)
    // - High resolution with decent bitrate
    if (height >= 2160 || bitrate > 8000 || (pixelCount > 2073600 && bitrate > 4000)) {
      return 'high';
    }

    // Fast quality recommendation for:
    // - Very low resolution (<720p)
    // - Low bitrate content (<2000 kbps)
    if (height < 720 || bitrate < 2000) {
      return 'fast';
    }

    // Medium quality for everything else
    return 'medium';
  }
}
