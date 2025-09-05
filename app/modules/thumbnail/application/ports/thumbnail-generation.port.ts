import type { Result } from '~/lib/result';

/**
 * Business-focused port for thumbnail generation operations.
 * This interface defines the contract for generating thumbnails from a business perspective,
 * abstracting away the complexity of FFmpeg operations and technical video processing details.
 */
export interface ThumbnailGenerationPort {
  /**
   * Generate a thumbnail from a video file
   * @param request - Business thumbnail generation request
   * @returns Promise resolving to thumbnail generation result or error
   */
  generateThumbnail(request: ThumbnailGenerationRequest): Promise<Result<ThumbnailGenerationResult, ThumbnailGenerationError>>;

  /**
   * Check if thumbnail generation system is available and ready
   * @returns Promise resolving to availability status
   */
  isThumbnailGenerationAvailable(): Promise<boolean>;
}

/**
 * Business-focused thumbnail generation request
 */
export interface ThumbnailGenerationRequest {
  /** Unique video identifier */
  videoId: string;
  /** Input video file path */
  inputPath: string;
  /** Output thumbnail file path */
  outputPath: string;
  /** Specific timestamp in seconds to extract thumbnail (optional, defaults to smart detection) */
  timestamp?: number;
  /** Whether to use smart scene detection to find best frame */
  useSmartScan?: boolean;
}

/**
 * Successful thumbnail generation result
 */
export interface ThumbnailGenerationResult {
  /** Path to the generated thumbnail file */
  outputPath: string;
  /** Size of the thumbnail file in bytes */
  fileSize: number;
  /** Timestamp used for extraction (in seconds) */
  extractedAtTimestamp: number;
  /** Whether smart scan was used */
  usedSmartScan: boolean;
}

/**
 * Base error for thumbnail generation operations
 */
export abstract class ThumbnailGenerationError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error when input video file is not found or inaccessible
 */
export class VideoNotFoundError extends ThumbnailGenerationError {
  readonly code = 'VIDEO_NOT_FOUND';
  readonly statusCode = 404;

  constructor(inputPath: string, cause?: Error) {
    super(`Video file not found: ${inputPath}`, cause);
  }
}

/**
 * Error when video format is not supported for thumbnail extraction
 */
export class UnsupportedVideoFormatError extends ThumbnailGenerationError {
  readonly code = 'UNSUPPORTED_VIDEO_FORMAT';
  readonly statusCode = 400;

  constructor(inputPath: string, cause?: Error) {
    super(`Unsupported video format: ${inputPath}`, cause);
  }
}

/**
 * Error when thumbnail generation process fails
 */
export class ThumbnailExtractionFailedError extends ThumbnailGenerationError {
  readonly code = 'THUMBNAIL_EXTRACTION_FAILED';
  readonly statusCode = 500;

  constructor(message: string, cause?: Error) {
    super(`Thumbnail extraction failed: ${message}`, cause);
  }
}

/**
 * Error when thumbnail generation system is unavailable
 */
export class ThumbnailSystemUnavailableError extends ThumbnailGenerationError {
  readonly code = 'THUMBNAIL_SYSTEM_UNAVAILABLE';
  readonly statusCode = 503;

  constructor(cause?: Error) {
    super('Thumbnail generation system is currently unavailable', cause);
  }
}

/**
 * Error when insufficient system resources to generate thumbnail
 */
export class InsufficientResourcesError extends ThumbnailGenerationError {
  readonly code = 'INSUFFICIENT_RESOURCES';
  readonly statusCode = 503;

  constructor(cause?: Error) {
    super('Insufficient system resources for thumbnail generation', cause);
  }
}
