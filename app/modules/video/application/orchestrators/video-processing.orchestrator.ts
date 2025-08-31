import { Result } from '~/lib/result';
import type { VideoAnalysisPort } from '../ports/video-analysis.port';
import type { VideoPackagingPort } from '../ports/video-packaging.port';
import type { VideoTranscodingPort } from '../ports/video-transcoding.port';
import type { WorkspaceManagerPort } from '../ports/workspace-manager.port';

/**
 * Business-focused video processing orchestrator that coordinates the complete workflow.
 * Uses dependency injection with port interfaces for clean architecture.
 */
export class VideoProcessingOrchestrator {
  constructor(
    private readonly workspaceManager: WorkspaceManagerPort,
    private readonly videoAnalysis: VideoAnalysisPort,
    private readonly videoTranscoding: VideoTranscodingPort,
    private readonly videoPackaging: VideoPackagingPort,
  ) {}

  /**
   * Execute the complete video processing workflow
   */
  async processVideo(request: VideoProcessingRequest): Promise<Result<VideoProcessingResult, VideoProcessingError>> {
    const { videoId, inputPath, quality, useGpu } = request;

    try {
      console.log(`🎬 [VideoProcessingOrchestrator] Starting processing for video: ${videoId}`);

      // Step 1: Create workspace
      const workspaceResult = await this.workspaceManager.createWorkspace(videoId);
      if (!workspaceResult.success) {
        return Result.fail(new VideoProcessingError(videoId, `Workspace creation failed: ${workspaceResult.error.message}`));
      }
      const workspace = workspaceResult.data;

      // Step 2: Analyze video
      const analysisResult = await this.videoAnalysis.analyzeVideo(inputPath);
      if (!analysisResult.success) {
        return Result.fail(new VideoProcessingError(videoId, `Video analysis failed: ${analysisResult.error.message}`));
      }
      const metadata = analysisResult.data;

      // Step 3: Get encoding recommendations
      const encodingResult = await this.videoAnalysis.recommendEncodingSettings(metadata, quality, useGpu);
      if (!encodingResult.success) {
        return Result.fail(new VideoProcessingError(videoId, `Encoding recommendation failed: ${encodingResult.error.message}`));
      }

      // Step 4: Transcode video
      const transcodingRequest = {
        videoId,
        inputPath,
        outputDir: workspace.rootDir,
        quality,
        useGpuAcceleration: useGpu,
        videoMetadata: metadata,
        audioHandling: 'optimize' as const,
      };

      const transcodingResult = await this.videoTranscoding.transcodeVideo(transcodingRequest);
      if (!transcodingResult.success) {
        return Result.fail(new VideoProcessingError(videoId, `Transcoding failed: ${transcodingResult.error.message}`));
      }
      const transcodedVideo = transcodingResult.data;

      // Step 5: Package for streaming
      const packagingRequest = {
        videoId,
        transcodedVideoPath: transcodedVideo.transcodedFilePath,
        outputDirectory: workspace.rootDir,
        securityLevel: 'standard' as const,
        streamingOptimization: {
          segmentDurationSeconds: 10,
          liveStreamingCompatible: false,
          targetQuality: 'standard' as const,
        },
      };

      const packagingResult = await this.videoPackaging.packageVideoForStreaming(packagingRequest);
      if (!packagingResult.success) {
        return Result.fail(new VideoProcessingError(videoId, `Packaging failed: ${packagingResult.error.message}`));
      }
      const packagedVideo = packagingResult.data;

      // Step 6: Validate the result
      const validationResult = await this.videoPackaging.validatePackagedVideo(videoId, workspace.rootDir);
      if (!validationResult.success || !validationResult.data.isValid) {
        const issues = validationResult.success ? validationResult.data.issues : ['Validation failed'];
        return Result.fail(new VideoProcessingError(videoId, `Validation failed: ${issues.join(', ')}`));
      }

      // Step 7: Clean up temporary files
      await this.workspaceManager.cleanupTemporaryFiles(videoId);

      const result: VideoProcessingResult = {
        videoId,
        manifestPath: packagedVideo.manifestPath,
        keyPath: packagedVideo.keyPath,
        thumbnailPath: workspace.thumbnailPath,
        totalSegments: packagedVideo.totalSegments,
        processingDurationSeconds: transcodedVideo.processingDurationSeconds + packagedVideo.processingDurationSeconds,
        outputFileSize: packagedVideo.packagedSize,
        metadata,
        qualityMetrics: transcodedVideo.qualityMetrics,
      };

      console.log(`✅ [VideoProcessingOrchestrator] Processing completed for video: ${videoId}`);
      return Result.ok(result) as Result<VideoProcessingResult, VideoProcessingError>;
    }
    catch (error) {
      if (error instanceof Error) {
        return Result.fail(new VideoProcessingError(videoId, error.message));
      }
      return Result.fail(new VideoProcessingError(videoId, 'Unknown processing error'));
    }
  }

  /**
   * Get estimated processing time for a video
   */
  async estimateProcessingTime(inputPath: string, quality: 'high' | 'medium' | 'fast'): Promise<number> {
    try {
      const analysisResult = await this.videoAnalysis.analyzeVideo(inputPath);
      if (!analysisResult.success) {
        return 300; // Default 5 minutes if analysis fails
      }

      return await this.videoTranscoding.estimateProcessingTime(analysisResult.data, quality);
    }
    catch {
      return 300; // Default 5 minutes if estimation fails
    }
  }

  /**
   * Check if the processing system is ready
   */
  async isProcessingSystemReady(): Promise<boolean> {
    try {
      const transcodingReady = await this.videoTranscoding.isTranscodingAvailable();
      const packagingReady = await this.videoPackaging.isPackagingAvailable();

      return transcodingReady && packagingReady;
    }
    catch {
      return false;
    }
  }
}

/**
 * Business request for video processing
 */
export interface VideoProcessingRequest {
  videoId: string;
  inputPath: string;
  quality: 'high' | 'medium' | 'fast';
  useGpu: boolean;
}

/**
 * Business result for video processing
 */
export interface VideoProcessingResult {
  videoId: string;
  manifestPath: string;
  keyPath: string;
  thumbnailPath: string;
  totalSegments: number;
  processingDurationSeconds: number;
  outputFileSize: number;
  metadata: {
    duration: number;
    bitrate: number;
    width: number;
    height: number;
    resolution: string;
  };
  qualityMetrics: {
    videoBitrate: number;
    audioBitrate: number;
    videoCodec: string;
    audioCodec: string;
  };
}

/**
 * Business error for video processing
 */
export class VideoProcessingError extends Error {
  constructor(
    public readonly videoId: string,
    message: string,
  ) {
    super(`Video processing failed for ${videoId}: ${message}`);
    this.name = 'VideoProcessingError';
  }
}
