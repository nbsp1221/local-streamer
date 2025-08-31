import { Result } from '~/lib/result';
import type {
  InsufficientSpaceError,
  VideoWorkspacePaths,
  WorkspaceCleanupResult,
  WorkspaceCreationError,
  WorkspaceError,
  WorkspaceManagerPort,
  WorkspaceNotFoundError,
} from '../../application/ports/workspace-manager.port';
import type { WorkspaceManagerService } from '../../storage/types/workspace-manager.types';
import {
  InsufficientSpaceError as PortInsufficientSpaceError,
  WorkspaceCreationError as PortWorkspaceCreationError,
  WorkspaceNotFoundError as PortWorkspaceNotFoundError,
} from '../../application/ports/workspace-manager.port';

/**
 * Adapter that implements the business-focused WorkspaceManagerPort
 * by delegating to the technical WorkspaceManagerService implementation.
 */
export class WorkspaceManagerAdapter implements WorkspaceManagerPort {
  constructor(
    private readonly workspaceService: WorkspaceManagerService,
  ) {}

  /**
   * Create a workspace for video processing
   */
  async createWorkspace(videoId: string): Promise<Result<VideoWorkspacePaths, WorkspaceError>> {
    try {
      const workspace = await this.workspaceService.createWorkspace({
        videoId,
        temporary: false,
        cleanupOnError: true,
      });

      const workspacePaths: VideoWorkspacePaths = {
        videoId: workspace.videoId,
        rootDir: workspace.rootDir,
        videoSegmentsDir: workspace.videoDir,
        audioSegmentsDir: workspace.audioDir,
        manifestPath: workspace.manifestPath,
        thumbnailPath: workspace.thumbnailPath,
        keyPath: workspace.keyPath,
      };

      return Result.ok(workspacePaths) as Result<VideoWorkspacePaths, WorkspaceError>;
    }
    catch (error) {
      if (error instanceof Error) {
        return Result.fail(new PortWorkspaceCreationError(videoId, error.message));
      }
      return Result.fail(new PortWorkspaceCreationError(videoId, 'Unknown error'));
    }
  }

  /**
   * Get paths for an existing workspace
   */
  async getWorkspacePaths(videoId: string): Promise<Result<VideoWorkspacePaths, WorkspaceError>> {
    try {
      const workspace = await this.workspaceService.getWorkspace(videoId);

      const workspacePaths: VideoWorkspacePaths = {
        videoId: workspace.videoId,
        rootDir: workspace.rootDir,
        videoSegmentsDir: workspace.videoDir,
        audioSegmentsDir: workspace.audioDir,
        manifestPath: workspace.manifestPath,
        thumbnailPath: workspace.thumbnailPath,
        keyPath: workspace.keyPath,
      };

      return Result.ok(workspacePaths) as Result<VideoWorkspacePaths, WorkspaceError>;
    }
    catch (error) {
      if (error?.constructor?.name === 'WorkspaceNotFoundError') {
        return Result.fail(new PortWorkspaceNotFoundError(videoId));
      }

      if (error instanceof Error) {
        return Result.fail(new PortWorkspaceCreationError(videoId, error.message));
      }

      return Result.fail(new PortWorkspaceNotFoundError(videoId));
    }
  }

  /**
   * Check if a workspace exists for the given video
   */
  async workspaceExists(videoId: string): Promise<boolean> {
    return this.workspaceService.workspaceExists(videoId);
  }

  /**
   * Clean up temporary files in a workspace after processing
   */
  async cleanupTemporaryFiles(videoId: string): Promise<Result<WorkspaceCleanupResult, WorkspaceError>> {
    try {
      const workspace = await this.workspaceService.getWorkspace(videoId);
      const cleanupResult = await this.workspaceService.cleanupTempFiles(workspace);

      const businessResult: WorkspaceCleanupResult = {
        success: cleanupResult.errors.length === 0,
        filesRemoved: cleanupResult.filesDeleted.length,
        bytesFreed: cleanupResult.sizeFreed,
        errors: cleanupResult.errors.length > 0 ? cleanupResult.errors : undefined,
      };

      return Result.ok(businessResult) as Result<WorkspaceCleanupResult, WorkspaceError>;
    }
    catch (error) {
      if (error?.constructor?.name === 'WorkspaceNotFoundError') {
        return Result.fail(new PortWorkspaceNotFoundError(videoId));
      }

      if (error instanceof Error) {
        return Result.fail(new PortWorkspaceCreationError(videoId, error.message));
      }

      return Result.fail(new PortWorkspaceNotFoundError(videoId));
    }
  }

  /**
   * Remove an entire workspace and all its contents
   */
  async removeWorkspace(videoId: string): Promise<Result<WorkspaceCleanupResult, WorkspaceError>> {
    try {
      const cleanupResult = await this.workspaceService.cleanupWorkspace(videoId);

      const businessResult: WorkspaceCleanupResult = {
        success: cleanupResult.errors.length === 0,
        filesRemoved: cleanupResult.filesDeleted.length + cleanupResult.directoriesDeleted.length,
        bytesFreed: cleanupResult.sizeFreed,
        errors: cleanupResult.errors.length > 0 ? cleanupResult.errors : undefined,
      };

      return Result.ok(businessResult) as Result<WorkspaceCleanupResult, WorkspaceError>;
    }
    catch (error) {
      if (error instanceof Error) {
        return Result.fail(new PortWorkspaceCreationError(videoId, error.message));
      }

      return Result.fail(new PortWorkspaceCreationError(videoId, 'Unknown error'));
    }
  }

  /**
   * Check if there's sufficient disk space for video processing
   */
  async hasInsufficientSpace(estimatedSize: number): Promise<boolean> {
    const hasEnoughSpace = await this.workspaceService.hasEnoughSpace(estimatedSize);
    return !hasEnoughSpace;
  }
}
