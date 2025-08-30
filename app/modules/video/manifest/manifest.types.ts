/**
 * Types for video manifest service
 * Handles DASH manifest serving and video availability checking
 */

import { Result } from '~/lib/result';

/**
 * Video manifest availability result
 */
export interface ManifestAvailabilityResult {
  /** Whether the manifest is available and ready for streaming */
  available: boolean;
  /** Reason why manifest is not available (if applicable) */
  reason?: 'manifest_not_found' | 'key_not_found' | 'workspace_not_found' | 'invalid_video_id';
}

/**
 * Video manifest content result
 */
export interface ManifestContentResult {
  /** DASH manifest content as string */
  content: string;
  /** Content type for HTTP response */
  contentType: 'application/dash+xml';
  /** File size in bytes */
  size: number;
}

/**
 * Segment path validation result
 */
export interface SegmentValidationResult {
  /** Whether the segment name is valid */
  valid: boolean;
  /** Type of segment if valid */
  segmentType?: 'init' | 'media';
  /** Stream type (video or audio) */
  streamType?: 'video' | 'audio';
  /** Segment number for media segments */
  segmentNumber?: number;
}

/**
 * Video manifest service interface
 * Provides read-only access to processed video manifests and segments
 */
export interface VideoManifestService {
  /**
   * Check if a video manifest is available and ready for streaming
   */
  isManifestAvailable(videoId: string): Promise<ManifestAvailabilityResult>;

  /**
   * Get DASH manifest content for a video
   */
  getManifestContent(videoId: string): Promise<Result<ManifestContentResult, ManifestError>>;

  /**
   * Validate segment name format and extract metadata
   */
  validateSegmentName(segmentName: string): SegmentValidationResult;

  /**
   * Get full path to a video segment file
   */
  getSegmentPath(videoId: string, segmentName: string): Promise<Result<string, ManifestError>>;
}

/**
 * Manifest-related errors
 */
export class ManifestError extends Error {
  constructor(
    message: string,
    public readonly code: ManifestErrorCode,
    public readonly videoId?: string,
    public readonly segmentName?: string,
  ) {
    super(message);
    this.name = 'ManifestError';
  }
}

export type ManifestErrorCode =
  | 'VIDEO_NOT_FOUND'
  | 'MANIFEST_NOT_FOUND'
  | 'KEY_NOT_FOUND'
  | 'WORKSPACE_ERROR'
  | 'INVALID_SEGMENT_NAME'
  | 'SEGMENT_NOT_FOUND'
  | 'FILE_READ_ERROR';

/**
 * Get manifest use case request
 */
export interface GetManifestRequest {
  /** Video ID to get manifest for */
  videoId: string;
  /** Whether to validate JWT token (default: true) */
  validateToken?: boolean;
}

/**
 * Get manifest use case result
 */
export interface GetManifestResult {
  /** DASH manifest content */
  manifestContent: string;
  /** HTTP response headers */
  headers: {
    'Content-Type': string;
    'Content-Length'?: string;
  };
}
