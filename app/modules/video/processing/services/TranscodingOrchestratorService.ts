import crypto from 'crypto';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { EncodingOptions, EnhancedEncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { VideoAnalysis } from '~/modules/video/analysis/video-analysis.types';
import { config } from '~/configs';
import { AESKeyManager } from '~/services/aes-key-manager.server';
import { generateSmartThumbnail } from '~/services/thumbnail-generator.server';
import type { TranscodingRequest } from '../types/ffmpeg-transcoding.types';
import type { EncryptionConfig, PackagingRequest } from '../types/shaka-packager.types';
import type {
  OrchestrationError,
  OrchestrationRequest,
  OrchestrationResult,
  ProcessingPhase,
  ProcessingStatistics,
  SystemRequirements,
  TranscodingOrchestratorService,
} from '../types/transcoding-orchestrator.types';
import { workspaceManagerService } from '../../storage/services/WorkspaceManagerService';
import { encodingValidationService } from '../../validation/services/EncodingValidationService';
import { ffmpegTranscodingService } from './FFmpegTranscodingService';
import { processExecutionService } from './ProcessExecutionService';
import { shakaPackagerService } from './ShakaPackagerService';

/**
 * Service that orchestrates the complete video transcoding workflow
 * Coordinates validation, transcoding, packaging, and cleanup
 */
export class TranscodingOrchestratorServiceImpl implements TranscodingOrchestratorService {
  private keyManager: AESKeyManager;
  private processingStats: Map<string, ProcessingStatistics> = new Map();

  constructor() {
    this.keyManager = new AESKeyManager();
  }

  /**
   * Execute the complete video transcoding and packaging workflow
   */
  async execute(request: OrchestrationRequest): Promise<OrchestrationResult> {
    const { videoId, inputPath, encodingOptions, videoAnalysis } = request;
    const startTime = Date.now();

    console.log(`🎬 [TranscodingOrchestrator] Starting orchestration for video: ${videoId}`);

    const statistics: ProcessingStatistics = {
      startTime: new Date(),
      endTime: new Date(),
      phaseDurations: {
        validation: 0,
        workspaceSetup: 0,
        transcoding: 0,
        packaging: 0,
        thumbnail: 0,
        cleanup: 0,
      },
      usedGpu: false,
      codec: '',
      segmentCount: 0,
      compressionRatio: 0,
    };

    try {
      // Phase 1: Validation
      const validationStart = Date.now();
      console.log(`📋 [TranscodingOrchestrator] Phase 1: Validation`);
      await this.validateRequest(request);
      statistics.phaseDurations.validation = Date.now() - validationStart;

      // Phase 2: Workspace Setup
      const workspaceStart = Date.now();
      console.log(`🏗️ [TranscodingOrchestrator] Phase 2: Workspace Setup`);
      const workspace = await this.setupWorkspace(videoId);
      statistics.phaseDurations.workspaceSetup = Date.now() - workspaceStart;

      // Phase 3: Key Generation
      console.log(`🔐 [TranscodingOrchestrator] Phase 3: Key Generation`);
      const encryptionConfig = await this.generateEncryptionKeys(videoId);

      // Phase 4: Transcoding
      const transcodingStart = Date.now();
      console.log(`🎯 [TranscodingOrchestrator] Phase 4: Transcoding (${videoAnalysis.duration}s video)`);
      console.log(`⚡ [TranscodingOrchestrator] Starting video encoding - progress will be displayed below...`);
      const transcodingResult = await this.executeTranscoding(request, workspace);
      statistics.phaseDurations.transcoding = Date.now() - transcodingStart;
      statistics.usedGpu = transcodingResult.usedGpu;
      statistics.codec = transcodingResult.codec;
      console.log(`✅ [TranscodingOrchestrator] Transcoding completed in ${(statistics.phaseDurations.transcoding / 1000).toFixed(1)}s`);

      // Phase 5: Packaging
      const packagingStart = Date.now();
      console.log(`📦 [TranscodingOrchestrator] Phase 5: DASH Packaging with AES-128 encryption`);
      const packagingResult = await this.executePackaging(videoId, workspace, encryptionConfig);
      statistics.phaseDurations.packaging = Date.now() - packagingStart;
      statistics.segmentCount = packagingResult.segmentCount;
      console.log(`✅ [TranscodingOrchestrator] Packaging completed - ${packagingResult.segmentCount} segments created`);

      // Phase 6: Thumbnail Generation
      let thumbnailPath: string | undefined;
      if (request.generateThumbnail !== false) {
        const thumbnailStart = Date.now();
        console.log(`🖼️ [TranscodingOrchestrator] Phase 6: Thumbnail Generation`);
        thumbnailPath = await this.generateThumbnail(videoId, inputPath);
        statistics.phaseDurations.thumbnail = Date.now() - thumbnailStart;
      }

      // Phase 7: Cleanup
      const cleanupStart = Date.now();
      console.log(`🧹 [TranscodingOrchestrator] Phase 7: Cleanup`);
      await this.performCleanup(workspace, inputPath, request.cleanupOriginal);
      statistics.phaseDurations.cleanup = Date.now() - cleanupStart;

      // Calculate statistics
      const totalDuration = Date.now() - startTime;
      statistics.endTime = new Date();

      // Get file sizes
      const originalSize = await workspaceManagerService.getFileSize(inputPath);
      const packagedSize = await this.calculatePackagedSize(workspace.rootDir);
      statistics.compressionRatio = packagedSize / originalSize;

      const result: OrchestrationResult = {
        videoId,
        manifestPath: workspace.manifestPath,
        thumbnailPath,
        totalDuration,
        transcoding: transcodingResult,
        packaging: packagingResult,
        fileSizes: {
          original: originalSize,
          intermediate: transcodingResult.fileSize || 0,
          packaged: packagedSize,
        },
        statistics,
      };

      // Store statistics
      this.processingStats.set(videoId, statistics);

      console.log(`✅ [TranscodingOrchestrator] Orchestration completed in ${totalDuration}ms`);
      console.log(`📊 [TranscodingOrchestrator] Final stats: ${statistics.segmentCount} segments, ${(statistics.compressionRatio * 100).toFixed(1)}% compression`);

      return result;
    }
    catch (error) {
      console.error(`❌ [TranscodingOrchestrator] Orchestration failed for ${videoId}:`, error);

      // Attempt cleanup on error
      try {
        const workspace = await workspaceManagerService.getWorkspace(videoId);
        await workspaceManagerService.cleanupWorkspace(videoId);
      }
      catch (cleanupError) {
        console.error(`❌ [TranscodingOrchestrator] Cleanup failed:`, cleanupError);
      }

      throw error;
    }
  }

  /**
   * Check if all required tools are available
   */
  async checkSystemRequirements(): Promise<SystemRequirements> {
    console.log(`🔍 [TranscodingOrchestrator] Checking system requirements`);

    const requirements: SystemRequirements = {
      ffmpeg: {
        available: false,
        codecs: [],
      },
      shakaPackager: {
        available: false,
      },
      diskSpace: {
        available: 0,
        path: config.paths.videos,
      },
      gpu: {
        available: false,
      },
    };

    // Check FFmpeg
    try {
      requirements.ffmpeg.available = await ffmpegTranscodingService.isAvailable();
      if (requirements.ffmpeg.available) {
        requirements.ffmpeg.version = await ffmpegTranscodingService.getVersion();
        requirements.ffmpeg.codecs = encodingValidationService.getSupportedCodecs().map(c => c.codec);
      }
    }
    catch {
      // FFmpeg not available
    }

    // Check Shaka Packager
    try {
      requirements.shakaPackager.available = await shakaPackagerService.isAvailable();
      if (requirements.shakaPackager.available) {
        requirements.shakaPackager.version = await shakaPackagerService.getVersion();
      }
    }
    catch {
      // Shaka Packager not available
    }

    // Check disk space
    requirements.diskSpace.available = await workspaceManagerService.getAvailableSpace();

    // Check GPU availability (simplified check)
    requirements.gpu.available = await this.checkGpuAvailability();

    return requirements;
  }

  /**
   * Get orchestration statistics for a video
   */
  async getProcessingStatistics(videoId: string): Promise<ProcessingStatistics | null> {
    return this.processingStats.get(videoId) || null;
  }

  /**
   * Validate the orchestration request
   */
  private async validateRequest(request: OrchestrationRequest): Promise<void> {
    const { videoId, inputPath, encodingOptions } = request;

    // Validate input file exists
    if (!await workspaceManagerService.fileExists(inputPath)) {
      throw this.createError('validation', `Input file not found: ${inputPath}`, videoId);
    }

    // Validate encoding options
    const validation = encodingValidationService.validateEncodingOptions(encodingOptions);
    if (!validation.valid) {
      const errorMessages = validation.errors.map(e => e.message).join(', ');
      throw this.createError('validation', `Invalid encoding options: ${errorMessages}`, videoId);
    }

    // Check disk space
    const requiredSpace = await workspaceManagerService.getFileSize(inputPath) * 3; // Rough estimate
    if (!await workspaceManagerService.hasEnoughSpace(requiredSpace)) {
      throw this.createError('validation', 'Insufficient disk space for transcoding', videoId);
    }

    console.log(`✅ [TranscodingOrchestrator] Validation passed for ${videoId}`);
  }

  /**
   * Set up workspace for video processing
   */
  private async setupWorkspace(videoId: string) {
    const workspace = await workspaceManagerService.createWorkspace({
      videoId,
      cleanupOnError: true,
    });

    console.log(`📁 [TranscodingOrchestrator] Workspace created: ${workspace.rootDir}`);
    return workspace;
  }

  /**
   * Generate encryption keys for the video
   */
  private async generateEncryptionKeys(videoId: string): Promise<EncryptionConfig> {
    // Generate and store AES key
    const key = this.keyManager.generateVideoKey(videoId);
    await this.keyManager.storeVideoKey(videoId, key);

    // Generate key ID
    const keyId = this.generateKeyId(videoId);

    console.log(`🔐 [TranscodingOrchestrator] Generated encryption keys for ${videoId}`);
    console.log(`🔑 [TranscodingOrchestrator] Key ID: ${keyId}`);

    return {
      scheme: 'cenc',
      key: key.toString('hex'),
      keyId,
      drmLabel: 'CENC',
    };
  }

  /**
   * Execute transcoding phase
   */
  private async executeTranscoding(request: OrchestrationRequest, workspace: any) {
    const transcodingRequest: TranscodingRequest = {
      inputPath: request.inputPath,
      outputPath: workspace.intermediatePath,
      videoId: request.videoId,
      encodingOptions: request.encodingOptions,
      videoAnalysis: request.videoAnalysis,
    };

    return ffmpegTranscodingService.transcode(transcodingRequest);
  }

  /**
   * Execute packaging phase
   */
  private async executePackaging(videoId: string, workspace: any, encryptionConfig: EncryptionConfig) {
    const packagingRequest: PackagingRequest = {
      videoId,
      inputPath: workspace.intermediatePath,
      outputDir: workspace.rootDir,
      encryption: encryptionConfig,
      segmentDuration: parseInt(process.env.HLS_SEGMENT_DURATION || '10'),
      staticLiveMpd: true,
    };

    return shakaPackagerService.package(packagingRequest);
  }

  /**
   * Generate thumbnail for the video
   */
  private async generateThumbnail(videoId: string, inputPath: string): Promise<string> {
    const videoDir = join(config.paths.videos, videoId);
    const thumbnailPath = join(videoDir, 'thumbnail.jpg');

    await generateSmartThumbnail(inputPath, thumbnailPath);

    console.log(`🖼️ [TranscodingOrchestrator] Thumbnail generated: ${thumbnailPath}`);
    return thumbnailPath;
  }

  /**
   * Perform cleanup operations
   */
  private async performCleanup(workspace: any, originalPath: string, cleanupOriginal?: boolean): Promise<void> {
    // Clean up workspace temporary files
    const cleanupResult = await workspaceManagerService.cleanupTempFiles(workspace);
    console.log(`🧹 [TranscodingOrchestrator] Cleaned up ${cleanupResult.filesDeleted.length} temporary files`);

    // Remove original file if requested
    if (cleanupOriginal) {
      await workspaceManagerService.removeFile(originalPath);
      console.log(`🗑️ [TranscodingOrchestrator] Removed original file: ${originalPath}`);
    }

    // Clean up key manager temporary files
    await this.keyManager.cleanupTempFiles(workspace.videoId);
  }

  /**
   * Generate consistent key ID from video ID
   */
  private generateKeyId(videoId: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(videoId);
    const digest = hash.digest();
    return digest.subarray(0, 16).toString('hex');
  }

  /**
   * Check GPU availability
   */
  private async checkGpuAvailability(): Promise<boolean> {
    try {
      // Try to detect NVIDIA GPU
      await processExecutionService.execute({
        command: 'nvidia-smi',
        args: ['--query-gpu=name', '--format=csv,noheader'],
        captureStdout: true,
      });
      return true;
    }
    catch {
      return false;
    }
  }

  /**
   * Calculate total size of packaged files
   */
  private async calculatePackagedSize(rootDir: string): Promise<number> {
    let totalSize = 0;

    try {
      // Add manifest size
      const manifestPath = join(rootDir, 'manifest.mpd');
      if (await workspaceManagerService.fileExists(manifestPath)) {
        totalSize += await workspaceManagerService.getFileSize(manifestPath);
      }

      // Add video segments
      const videoFiles = await workspaceManagerService.listFiles(join(rootDir, 'video'));
      for (const file of videoFiles) {
        totalSize += await workspaceManagerService.getFileSize(join(rootDir, 'video', file));
      }

      // Add audio segments
      const audioFiles = await workspaceManagerService.listFiles(join(rootDir, 'audio'));
      for (const file of audioFiles) {
        totalSize += await workspaceManagerService.getFileSize(join(rootDir, 'audio', file));
      }
    }
    catch {
      // Ignore errors in size calculation
    }

    return totalSize;
  }

  /**
   * Create an orchestration error
   */
  private createError(phase: ProcessingPhase, message: string, videoId: string, originalError?: Error): OrchestrationError {
    const error = new Error(message) as OrchestrationError;
    error.phase = phase;
    error.videoId = videoId;
    error.originalError = originalError;
    return error;
  }
}

// Export singleton instance
export const transcodingOrchestratorService = new TranscodingOrchestratorServiceImpl();
