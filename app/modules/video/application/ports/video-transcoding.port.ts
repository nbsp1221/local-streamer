import type { Result } from '~/lib/result';

/**
 * Business-focused port for video transcoding operations.
 * This interface defines the contract for transcoding videos from a business perspective,
 * hiding the complexity of FFmpeg operations and technical encoding details.
 */
export interface VideoTranscodingPort {
  /**
   * Transcode a video with business-level quality settings
   * @param request - Business transcoding request
   * @returns Promise resolving to transcoding result or error
   */
  transcodeVideo(request: TranscodingRequest): Promise<Result<TranscodingResult, TranscodingError>>;

  /**
   * Check if transcoding system is available and ready
   * @returns Promise resolving to availability status
   */
  isTranscodingAvailable(): Promise<boolean>;

  /**
   * Get estimated processing time for a video
   * @param metadata - Video metadata from analysis
   * @param quality - Target quality level
   * @returns Promise resolving to estimated duration in seconds
   */
  estimateProcessingTime(metadata: VideoMetadata, quality: TranscodingQuality): Promise<number>;
}

/**
 * Business-focused transcoding request
 */
export interface TranscodingRequest {
  /** Unique video identifier */
  videoId: string;
  /** Input video file path */
  inputPath: string;
  /** Output directory (service determines specific file paths) */
  outputDir: string;
  /** Target quality level */
  quality: TranscodingQuality;
  /** Whether to use GPU acceleration if available */
  useGpuAcceleration: boolean;
  /** Video metadata from analysis */
  videoMetadata: VideoMetadata;
  /** Audio settings preference */
  audioHandling: AudioHandling;
}

/**
 * Business transcoding result
 */
export interface TranscodingResult {
  /** Video identifier */
  videoId: string;
  /** Path to the transcoded video file */
  transcodedFilePath: string;
  /** Processing duration in seconds */
  processingDurationSeconds: number;
  /** Whether GPU was used for acceleration */
  usedGpuAcceleration: boolean;
  /** Final output file size in bytes */
  outputFileSize: number;
  /** Quality metrics of the transcoded video */
  qualityMetrics: {
    /** Final video bitrate achieved */
    videoBitrate: number;
    /** Final audio bitrate achieved */
    audioBitrate: number;
    /** Codec used for video */
    videoCodec: string;
    /** Codec used for audio */
    audioCodec: string;
  };
}

/**
 * Business quality levels for transcoding
 */
export type TranscodingQuality = 'high' | 'medium' | 'fast';

/**
 * Audio handling strategies
 */
export type AudioHandling = 'preserve' | 'optimize' | 'standardize';

/**
 * Video metadata (simplified for business use)
 */
export interface VideoMetadata {
  duration: number;
  bitrate: number;
  audioBitrate: number;
  videoCodec: string;
  audioCodec: string;
  fileSize: number;
  width: number;
  height: number;
  frameRate: number;
}

/**
 * Business errors for transcoding operations
 */
export abstract class TranscodingError extends Error {
  constructor(
    message: string,
    public readonly videoId: string,
  ) {
    super(message);
    this.name = 'TranscodingError';
  }
}

export class TranscodingSystemUnavailableError extends TranscodingError {
  constructor(videoId: string, reason: string) {
    super(`Transcoding system unavailable for video ${videoId}: ${reason}`, videoId);
    this.name = 'TranscodingSystemUnavailableError';
  }
}

export class TranscodingFailedError extends TranscodingError {
  constructor(videoId: string, reason: string, public readonly inputPath: string) {
    super(`Transcoding failed for video ${videoId}: ${reason}`, videoId);
    this.name = 'TranscodingFailedError';
  }
}

export class UnsupportedVideoCodecError extends TranscodingError {
  constructor(videoId: string, codec: string) {
    super(`Unsupported video codec ${codec} for video ${videoId}`, videoId);
    this.name = 'UnsupportedVideoCodecError';
  }
}

export class InsufficientResourcesError extends TranscodingError {
  constructor(videoId: string, resource: string) {
    super(`Insufficient ${resource} for transcoding video ${videoId}`, videoId);
    this.name = 'InsufficientResourcesError';
  }
}
