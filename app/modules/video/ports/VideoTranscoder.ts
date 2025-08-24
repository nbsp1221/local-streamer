import type { VideoProcessingError } from '~/lib/errors';
import type { Result } from '~/lib/result';

/**
 * Defines the business-level contract for video processing operations.
 * This interface is technology-agnostic and focuses on "what" to do, not "how".
 */
export interface VideoTranscoder {
  /**
   * Transcodes a source video file into a secure, streamable format.
   * This operation is idempotent and should handle video analysis,
   * thumbnail generation, encryption, and packaging.
   *
   * @param request - The details of the transcoding job.
   * @returns A Result object containing the paths to the generated assets or a domain-specific error.
   */
  transcode(request: TranscodeRequest): Promise<Result<TranscodeResult, VideoProcessingError>>;

  /**
   * Extracts technical metadata from a video file.
   *
   * @param filePath - The absolute path to the video file.
   * @returns A Result object with the video's metadata or an error.
   */
  extractMetadata(filePath: string): Promise<Result<VideoMetadata, VideoProcessingError>>;
}

/**
 * Business-level request to transcode a video.
 */
export interface TranscodeRequest {
  /** A unique identifier for the video being processed. */
  videoId: string;
  /** The absolute path to the source video file. */
  sourcePath: string;
  /** The desired quality level for the output. */
  quality: 'high' | 'medium' | 'fast';
  /** Whether to prioritize GPU for processing if available. */
  useGpu: boolean;
}

/**
 * The successful result of a transcoding operation.
 */
export interface TranscodeResult {
  videoId: string;
  /** Path to the main streaming manifest (e.g., manifest.mpd). */
  manifestPath: string;
  /** Path to the generated, encrypted thumbnail. */
  thumbnailPath: string;
  /** Duration of the video in seconds. */
  duration: number;
}

/**
 * Technical metadata extracted from a video file.
 */
export interface VideoMetadata {
  duration: number; // in seconds
  bitrate: number; // in kbps
  videoCodec: string;
  audioCodec: string;
}
