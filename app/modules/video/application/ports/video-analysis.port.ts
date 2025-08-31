import type { Result } from '~/lib/result';

/**
 * Business-focused port for video analysis operations.
 * This interface defines the contract for extracting video metadata and
 * making encoding decisions from a business perspective.
 */
export interface VideoAnalysisPort {
  /**
   * Analyze a video file to extract technical metadata
   * @param filePath - Absolute path to the video file
   * @returns Promise resolving to video metadata or analysis error
   */
  analyzeVideo(filePath: string): Promise<Result<VideoMetadata, VideoAnalysisError>>;

  /**
   * Calculate optimal encoding settings for a video
   * @param metadata - Video metadata from analysis
   * @param targetQuality - Desired quality level for encoding
   * @param useGpu - Whether GPU acceleration is available
   * @returns Promise resolving to encoding recommendations
   */
  recommendEncodingSettings(
    metadata: VideoMetadata,
    targetQuality: 'high' | 'medium' | 'fast',
    useGpu: boolean
  ): Promise<Result<EncodingRecommendation, VideoAnalysisError>>;
}

/**
 * Business-focused video metadata
 */
export interface VideoMetadata {
  /** Video duration in seconds */
  duration: number;
  /** Overall bitrate in kbps */
  bitrate: number;
  /** Audio bitrate in kbps */
  audioBitrate: number;
  /** Video codec (e.g., 'h264', 'h265') */
  videoCodec: string;
  /** Audio codec (e.g., 'aac', 'mp3') */
  audioCodec: string;
  /** File size in bytes */
  fileSize: number;
  /** Video width in pixels */
  width: number;
  /** Video height in pixels */
  height: number;
  /** Frame rate (fps) */
  frameRate: number;
  /** Human-readable resolution (e.g., '1920x1080') */
  resolution: string;
  /** Quality assessment for encoding decisions */
  qualityLevel: 'high' | 'medium' | 'low';
}

/**
 * Business-focused encoding recommendations
 */
export interface EncodingRecommendation {
  /** Recommended target video bitrate in kbps */
  targetVideoBitrate: number;
  /** Audio encoding settings */
  audioSettings: {
    /** Audio codec to use ('copy' to keep original, 'aac' to re-encode) */
    codec: 'copy' | 'aac';
    /** Target bitrate for audio (empty if copying) */
    bitrate: string;
  };
  /** Whether the source needs transcoding */
  requiresTranscoding: boolean;
  /** Estimated processing complexity (for progress indication) */
  processingComplexity: 'low' | 'medium' | 'high';
  /** Estimated output file size in bytes */
  estimatedOutputSize: number;
}

/**
 * Business errors for video analysis operations
 */
export abstract class VideoAnalysisError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
  ) {
    super(message);
    this.name = 'VideoAnalysisError';
  }
}

export class VideoFileNotFoundError extends VideoAnalysisError {
  constructor(filePath: string) {
    super(`Video file not found: ${filePath}`, filePath);
    this.name = 'VideoFileNotFoundError';
  }
}

export class UnsupportedVideoFormatError extends VideoAnalysisError {
  constructor(filePath: string, format?: string) {
    super(
      `Unsupported video format${format ? ` (${format})` : ''}: ${filePath}`,
      filePath,
    );
    this.name = 'UnsupportedVideoFormatError';
  }
}

export class VideoAnalysisFailedError extends VideoAnalysisError {
  constructor(filePath: string, reason: string) {
    super(`Failed to analyze video ${filePath}: ${reason}`, filePath);
    this.name = 'VideoAnalysisFailedError';
  }
}
