import type { Result } from '~/lib/result';

/**
 * Business-focused port for workspace management operations.
 * This interface defines the contract for managing video processing workspaces
 * from a business perspective, hiding implementation details.
 */
export interface WorkspaceManagerPort {
  /**
   * Create a workspace for video processing
   * @param videoId - Unique identifier for the video
   * @returns Promise resolving to the workspace paths needed for processing
   */
  createWorkspace(videoId: string): Promise<Result<VideoWorkspacePaths, WorkspaceError>>;

  /**
   * Get paths for an existing workspace
   * @param videoId - Unique identifier for the video
   * @returns Promise resolving to the workspace paths
   */
  getWorkspacePaths(videoId: string): Promise<Result<VideoWorkspacePaths, WorkspaceError>>;

  /**
   * Check if a workspace exists for the given video
   * @param videoId - Unique identifier for the video
   * @returns Promise resolving to boolean indicating existence
   */
  workspaceExists(videoId: string): Promise<boolean>;

  /**
   * Clean up temporary files in a workspace after processing
   * @param videoId - Unique identifier for the video
   * @returns Promise resolving to cleanup results
   */
  cleanupTemporaryFiles(videoId: string): Promise<Result<WorkspaceCleanupResult, WorkspaceError>>;

  /**
   * Remove an entire workspace and all its contents
   * @param videoId - Unique identifier for the video
   * @returns Promise resolving to cleanup results
   */
  removeWorkspace(videoId: string): Promise<Result<WorkspaceCleanupResult, WorkspaceError>>;

  /**
   * Check if there's sufficient disk space for video processing
   * @param estimatedSize - Estimated size needed in bytes
   * @returns Promise resolving to boolean indicating sufficient space
   */
  hasInsufficientSpace(estimatedSize: number): Promise<boolean>;
}

/**
 * Business-focused workspace paths for video processing
 */
export interface VideoWorkspacePaths {
  /** Unique video identifier */
  videoId: string;
  /** Root directory for this video's files */
  rootDir: string;
  /** Directory for video segments */
  videoSegmentsDir: string;
  /** Directory for audio segments */
  audioSegmentsDir: string;
  /** Path for the manifest file */
  manifestPath: string;
  /** Path for the thumbnail file */
  thumbnailPath: string;
  /** Path for the encryption key */
  keyPath: string;
}

/**
 * Business-focused cleanup result
 */
export interface WorkspaceCleanupResult {
  /** Whether the cleanup was successful */
  success: boolean;
  /** Number of files removed */
  filesRemoved: number;
  /** Total bytes freed */
  bytesFreed: number;
  /** Any errors encountered (for partial failures) */
  errors?: string[];
}

/**
 * Business error for workspace operations
 */
export abstract class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly videoId: string,
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export class WorkspaceNotFoundError extends WorkspaceError {
  constructor(videoId: string) {
    super(`Workspace not found for video: ${videoId}`, videoId);
    this.name = 'WorkspaceNotFoundError';
  }
}

export class WorkspaceCreationError extends WorkspaceError {
  constructor(videoId: string, reason: string) {
    super(`Failed to create workspace for video ${videoId}: ${reason}`, videoId);
    this.name = 'WorkspaceCreationError';
  }
}

export class InsufficientSpaceError extends WorkspaceError {
  constructor(videoId: string, required: number, available: number) {
    super(
      `Insufficient space for video ${videoId}: requires ${required} bytes, ${available} available`,
      videoId,
    );
    this.name = 'InsufficientSpaceError';
  }
}
