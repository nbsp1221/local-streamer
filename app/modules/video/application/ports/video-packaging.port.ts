import type { Result } from '~/lib/result';

/**
 * Business-focused port for video packaging operations.
 * This interface defines the contract for packaging transcoded videos into
 * streamable format with encryption from a business perspective.
 */
export interface VideoPackagingPort {
  /**
   * Package a transcoded video into secure streamable format
   * @param request - Business packaging request
   * @returns Promise resolving to packaging result or error
   */
  packageVideoForStreaming(request: PackagingRequest): Promise<Result<PackagingResult, PackagingError>>;

  /**
   * Check if packaging system is available and ready
   * @returns Promise resolving to availability status
   */
  isPackagingAvailable(): Promise<boolean>;

  /**
   * Validate that a packaged video is ready for streaming
   * @param videoId - Unique video identifier
   * @param packagedDir - Directory containing packaged files
   * @returns Promise resolving to validation result
   */
  validatePackagedVideo(videoId: string, packagedDir: string): Promise<Result<ValidationResult, PackagingError>>;
}

/**
 * Business-focused packaging request
 */
export interface PackagingRequest {
  /** Unique video identifier */
  videoId: string;
  /** Path to the transcoded video file */
  transcodedVideoPath: string;
  /** Output directory for packaged streaming files */
  outputDirectory: string;
  /** Security level for the packaged content */
  securityLevel: SecurityLevel;
  /** Streaming optimization preferences */
  streamingOptimization: StreamingOptimization;
}

/**
 * Business packaging result
 */
export interface PackagingResult {
  /** Video identifier */
  videoId: string;
  /** Path to the main streaming manifest */
  manifestPath: string;
  /** Path to the encryption key file */
  keyPath: string;
  /** Total number of segments created */
  totalSegments: number;
  /** Size of the packaged content in bytes */
  packagedSize: number;
  /** Duration of packaging operation in seconds */
  processingDurationSeconds: number;
  /** Streaming readiness status */
  streamingReady: boolean;
}

/**
 * Validation result for packaged videos
 */
export interface ValidationResult {
  /** Whether the package is valid for streaming */
  isValid: boolean;
  /** Manifest file exists and is accessible */
  manifestValid: boolean;
  /** Encryption key is properly configured */
  encryptionValid: boolean;
  /** All required segments are present */
  segmentsComplete: boolean;
  /** Any validation warnings or errors */
  issues: string[];
}

/**
 * Security levels for video packaging
 */
export type SecurityLevel = 'standard' | 'enhanced';

/**
 * Streaming optimization preferences
 */
export interface StreamingOptimization {
  /** Segment duration in seconds (affects seeking performance) */
  segmentDurationSeconds: number;
  /** Whether to optimize for live streaming compatibility */
  liveStreamingCompatible: boolean;
  /** Target streaming quality tier */
  targetQuality: 'standard' | 'high' | 'premium';
}

/**
 * Business errors for packaging operations
 */
export abstract class PackagingError extends Error {
  constructor(
    message: string,
    public readonly videoId: string,
  ) {
    super(message);
    this.name = 'PackagingError';
  }
}

export class PackagingSystemUnavailableError extends PackagingError {
  constructor(videoId: string, reason: string) {
    super(`Packaging system unavailable for video ${videoId}: ${reason}`, videoId);
    this.name = 'PackagingSystemUnavailableError';
  }
}

export class PackagingFailedError extends PackagingError {
  constructor(videoId: string, reason: string, public readonly inputPath: string) {
    super(`Packaging failed for video ${videoId}: ${reason}`, videoId);
    this.name = 'PackagingFailedError';
  }
}

export class EncryptionSetupError extends PackagingError {
  constructor(videoId: string, reason: string) {
    super(`Encryption setup failed for video ${videoId}: ${reason}`, videoId);
    this.name = 'EncryptionSetupError';
  }
}

export class ManifestCreationError extends PackagingError {
  constructor(videoId: string, reason: string) {
    super(`Manifest creation failed for video ${videoId}: ${reason}`, videoId);
    this.name = 'ManifestCreationError';
  }
}

export class PackageValidationError extends PackagingError {
  constructor(videoId: string, validationIssues: string[]) {
    super(
      `Package validation failed for video ${videoId}: ${validationIssues.join(', ')}`,
      videoId,
    );
    this.name = 'PackageValidationError';
  }
}
