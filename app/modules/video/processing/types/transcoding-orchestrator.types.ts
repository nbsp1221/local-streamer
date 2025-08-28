/**
 * Types for transcoding orchestrator service
 */

import type { EncodingOptions, EnhancedEncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { VideoAnalysis } from '~/modules/video/analysis/video-analysis.types';
import type { VideoWorkspace } from '~/modules/video/storage/types/workspace-manager.types';
import type { TranscodingResult } from './ffmpeg-transcoding.types';
import type { PackagingResult } from './shaka-packager.types';

export interface OrchestrationRequest {
  /** Video ID */
  videoId: string;
  /** Input file path */
  inputPath: string;
  /** Encoding options (legacy or enhanced) */
  encodingOptions: EncodingOptions | EnhancedEncodingOptions;
  /** Video analysis result */
  videoAnalysis: VideoAnalysis;
  /** Whether to generate thumbnail */
  generateThumbnail?: boolean;
  /** Whether to cleanup original file */
  cleanupOriginal?: boolean;
}

export interface OrchestrationResult {
  /** Video ID */
  videoId: string;
  /** Path to the manifest file */
  manifestPath: string;
  /** Path to the thumbnail */
  thumbnailPath?: string;
  /** Duration of the entire process */
  totalDuration: number;
  /** Transcoding result */
  transcoding: TranscodingResult;
  /** Packaging result */
  packaging: PackagingResult;
  /** File sizes */
  fileSizes: {
    original: number;
    intermediate: number;
    packaged: number;
  };
  /** Processing statistics */
  statistics: ProcessingStatistics;
}

export interface ProcessingStatistics {
  /** Start time */
  startTime: Date;
  /** End time */
  endTime: Date;
  /** Phase timings */
  phaseDurations: {
    validation: number;
    workspaceSetup: number;
    transcoding: number;
    packaging: number;
    thumbnail: number;
    cleanup: number;
  };
  /** Whether GPU was used */
  usedGpu: boolean;
  /** Actual codec used */
  codec: string;
  /** Number of segments created */
  segmentCount: number;
  /** Compression ratio (output/input) */
  compressionRatio: number;
}

export interface OrchestrationError extends Error {
  phase: ProcessingPhase;
  videoId: string;
  originalError?: Error;
}

export type ProcessingPhase =
  | 'validation'
  | 'workspace-setup'
  | 'key-generation'
  | 'transcoding'
  | 'packaging'
  | 'thumbnail'
  | 'cleanup';

export interface TranscodingOrchestratorService {
  /**
   * Execute the complete video transcoding and packaging workflow
   */
  execute(request: OrchestrationRequest): Promise<OrchestrationResult>;

  /**
   * Check if all required tools are available
   */
  checkSystemRequirements(): Promise<SystemRequirements>;

  /**
   * Get orchestration statistics for a video
   */
  getProcessingStatistics(videoId: string): Promise<ProcessingStatistics | null>;
}

export interface SystemRequirements {
  /** FFmpeg availability */
  ffmpeg: {
    available: boolean;
    version?: string;
    codecs: string[];
  };
  /** Shaka Packager availability */
  shakaPackager: {
    available: boolean;
    version?: string;
  };
  /** Available disk space */
  diskSpace: {
    available: number;
    path: string;
  };
  /** GPU availability */
  gpu: {
    available: boolean;
    type?: 'nvidia' | 'intel' | 'amd';
  };
}
