/**
 * Types for workspace management service
 */

export interface WorkspaceConfig {
  /** Video ID */
  videoId: string;
  /** Base videos directory */
  baseDir?: string;
  /** Create temporary workspace */
  temporary?: boolean;
  /** Cleanup on error */
  cleanupOnError?: boolean;
}

export interface VideoWorkspace {
  /** Video ID */
  videoId: string;
  /** Root directory for this video */
  rootDir: string;
  /** Video segments directory */
  videoDir: string;
  /** Audio segments directory */
  audioDir: string;
  /** Intermediate file path */
  intermediatePath: string;
  /** Manifest file path */
  manifestPath: string;
  /** Thumbnail file path */
  thumbnailPath: string;
  /** Encryption key file path */
  keyPath: string;
  /** Temporary files directory */
  tempDir: string;
  /** Whether this is a temporary workspace */
  isTemporary: boolean;
}

export interface FileOperationResult {
  /** Source path */
  source: string;
  /** Destination path */
  destination: string;
  /** Operation type */
  operation: 'move' | 'copy' | 'delete' | 'create';
  /** Success status */
  success: boolean;
  /** Error if failed */
  error?: string;
}

export interface CleanupResult {
  /** Files deleted */
  filesDeleted: string[];
  /** Directories deleted */
  directoriesDeleted: string[];
  /** Total size freed in bytes */
  sizeFreed: number;
  /** Errors encountered */
  errors: string[];
}

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly videoId: string,
    public readonly path?: string,
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

export class WorkspaceNotFoundError extends WorkspaceError {
  constructor(videoId: string, path: string) {
    super(`Workspace not found for video ${videoId}`, videoId, path);
    this.name = 'WorkspaceNotFoundError';
  }
}

export class InsufficientSpaceError extends WorkspaceError {
  constructor(
    requiredSpace: number,
    availableSpace: number,
    path: string,
  ) {
    super(
      `Insufficient space: required ${requiredSpace} bytes, available ${availableSpace} bytes`,
      '',
      path,
    );
    this.name = 'InsufficientSpaceError';
  }
}

export interface WorkspaceManagerService {
  /**
   * Create a workspace for video processing
   */
  createWorkspace(config: WorkspaceConfig): Promise<VideoWorkspace>;

  /**
   * Get an existing workspace
   */
  getWorkspace(videoId: string): Promise<VideoWorkspace>;

  /**
   * Check if workspace exists
   */
  workspaceExists(videoId: string): Promise<boolean>;

  /**
   * Move a file to the workspace
   */
  moveToWorkspace(sourcePath: string, workspace: VideoWorkspace, targetName?: string): Promise<FileOperationResult>;

  /**
   * Copy a file to the workspace
   */
  copyToWorkspace(sourcePath: string, workspace: VideoWorkspace, targetName?: string): Promise<FileOperationResult>;

  /**
   * Clean up temporary files in a workspace
   */
  cleanupTempFiles(workspace: VideoWorkspace): Promise<CleanupResult>;

  /**
   * Clean up an entire workspace
   */
  cleanupWorkspace(videoId: string): Promise<CleanupResult>;

  /**
   * Get available disk space
   */
  getAvailableSpace(path?: string): Promise<number>;

  /**
   * Check if there's enough space for an operation
   */
  hasEnoughSpace(requiredBytes: number, path?: string): Promise<boolean>;

  /**
   * Remove a file safely
   */
  removeFile(filePath: string): Promise<void>;

  /**
   * Check if a file exists
   */
  fileExists(filePath: string): Promise<boolean>;

  /**
   * Get file size
   */
  getFileSize(filePath: string): Promise<number>;

  /**
   * Read a file
   */
  readFile(filePath: string): Promise<Buffer>;

  /**
   * Write a file
   */
  writeFile(filePath: string, data: Buffer | string): Promise<void>;

  /**
   * List files in a directory
   */
  listFiles(dirPath: string, pattern?: string): Promise<string[]>;
}
