import { promises as fs } from 'fs';
import { statfs } from 'fs';
import { basename, join } from 'path';
import { promisify } from 'util';
import { config } from '~/configs';
import type {
  CleanupResult,
  FileOperationResult,
  VideoWorkspace,
  WorkspaceConfig,
  WorkspaceError,
  WorkspaceManagerService,
} from '../types/workspace-manager.types';
import {
  InsufficientSpaceError,
  WorkspaceNotFoundError,
} from '../types/workspace-manager.types';

const getStatfs = promisify(statfs);

/**
 * Service responsible for managing video processing workspaces
 * Handles file operations, directory management, and cleanup
 */
export class WorkspaceManagerServiceImpl implements WorkspaceManagerService {
  private readonly baseVideosDir: string;
  private readonly tempDir: string;

  constructor() {
    this.baseVideosDir = config.paths.videos;
    this.tempDir = '/tmp';
  }

  /**
   * Create a workspace for video processing
   */
  async createWorkspace(config: WorkspaceConfig): Promise<VideoWorkspace> {
    const { videoId, baseDir = this.baseVideosDir, temporary = false } = config;

    const rootDir = join(baseDir, videoId);
    const workspace: VideoWorkspace = {
      videoId,
      rootDir,
      videoDir: join(rootDir, 'video'),
      audioDir: join(rootDir, 'audio'),
      intermediatePath: join(rootDir, 'intermediate.mp4'),
      manifestPath: join(rootDir, 'manifest.mpd'),
      thumbnailPath: join(rootDir, 'thumbnail.jpg'),
      keyPath: join(rootDir, 'key.bin'),
      tempDir: join(rootDir, 'temp'),
      isTemporary: temporary,
    };

    // Create directories
    await this.createDirectories(workspace);

    console.log(`📁 [WorkspaceManager] Created workspace for video: ${videoId}`);
    console.log(`📍 [WorkspaceManager] Root directory: ${rootDir}`);

    return workspace;
  }

  /**
   * Get an existing workspace
   */
  async getWorkspace(videoId: string): Promise<VideoWorkspace> {
    const rootDir = join(this.baseVideosDir, videoId);

    // Check if workspace exists
    try {
      await fs.access(rootDir);
    }
    catch {
      throw new WorkspaceNotFoundError(videoId, rootDir);
    }

    return {
      videoId,
      rootDir,
      videoDir: join(rootDir, 'video'),
      audioDir: join(rootDir, 'audio'),
      intermediatePath: join(rootDir, 'intermediate.mp4'),
      manifestPath: join(rootDir, 'manifest.mpd'),
      thumbnailPath: join(rootDir, 'thumbnail.jpg'),
      keyPath: join(rootDir, 'key.bin'),
      tempDir: join(rootDir, 'temp'),
      isTemporary: false,
    };
  }

  /**
   * Check if workspace exists
   */
  async workspaceExists(videoId: string): Promise<boolean> {
    const rootDir = join(this.baseVideosDir, videoId);
    try {
      await fs.access(rootDir);
      return true;
    }
    catch {
      return false;
    }
  }

  /**
   * Move a file to the workspace
   */
  async moveToWorkspace(
    sourcePath: string,
    workspace: VideoWorkspace,
    targetName?: string,
  ): Promise<FileOperationResult> {
    const fileName = targetName || basename(sourcePath);
    const destination = join(workspace.rootDir, fileName);

    try {
      await fs.rename(sourcePath, destination);
      console.log(`📦 [WorkspaceManager] Moved ${sourcePath} to ${destination}`);

      return {
        source: sourcePath,
        destination,
        operation: 'move',
        success: true,
      };
    }
    catch (error) {
      console.error(`❌ [WorkspaceManager] Failed to move file:`, error);
      return {
        source: sourcePath,
        destination,
        operation: 'move',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Copy a file to the workspace
   */
  async copyToWorkspace(
    sourcePath: string,
    workspace: VideoWorkspace,
    targetName?: string,
  ): Promise<FileOperationResult> {
    const fileName = targetName || basename(sourcePath);
    const destination = join(workspace.rootDir, fileName);

    try {
      await fs.copyFile(sourcePath, destination);
      console.log(`📋 [WorkspaceManager] Copied ${sourcePath} to ${destination}`);

      return {
        source: sourcePath,
        destination,
        operation: 'copy',
        success: true,
      };
    }
    catch (error) {
      console.error(`❌ [WorkspaceManager] Failed to copy file:`, error);
      return {
        source: sourcePath,
        destination,
        operation: 'copy',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Clean up temporary files in a workspace
   */
  async cleanupTempFiles(workspace: VideoWorkspace): Promise<CleanupResult> {
    const result: CleanupResult = {
      filesDeleted: [],
      directoriesDeleted: [],
      sizeFreed: 0,
      errors: [],
    };

    // Clean up intermediate file
    if (await this.fileExists(workspace.intermediatePath)) {
      try {
        const size = await this.getFileSize(workspace.intermediatePath);
        await this.removeFile(workspace.intermediatePath);
        result.filesDeleted.push(workspace.intermediatePath);
        result.sizeFreed += size;
        console.log(`🧹 [WorkspaceManager] Deleted intermediate file: ${workspace.intermediatePath}`);
      }
      catch (error) {
        result.errors.push(`Failed to delete ${workspace.intermediatePath}: ${error}`);
      }
    }

    // Clean up temp directory
    if (await this.fileExists(workspace.tempDir)) {
      try {
        const files = await this.listFiles(workspace.tempDir);
        for (const file of files) {
          const filePath = join(workspace.tempDir, file);
          const size = await this.getFileSize(filePath);
          await this.removeFile(filePath);
          result.filesDeleted.push(filePath);
          result.sizeFreed += size;
        }

        await fs.rmdir(workspace.tempDir);
        result.directoriesDeleted.push(workspace.tempDir);
        console.log(`🧹 [WorkspaceManager] Cleaned temp directory: ${workspace.tempDir}`);
      }
      catch (error) {
        result.errors.push(`Failed to clean temp directory: ${error}`);
      }
    }

    // Clean up pass log files (for 2-pass encoding)
    const passLogPattern = /ffmpeg-pass.*\.log/;
    try {
      const files = await this.listFiles(workspace.rootDir);
      for (const file of files) {
        if (passLogPattern.test(file)) {
          const filePath = join(workspace.rootDir, file);
          const size = await this.getFileSize(filePath);
          await this.removeFile(filePath);
          result.filesDeleted.push(filePath);
          result.sizeFreed += size;
          console.log(`🧹 [WorkspaceManager] Deleted pass log: ${filePath}`);
        }
      }
    }
    catch (error) {
      result.errors.push(`Failed to clean pass logs: ${error}`);
    }

    console.log(`✨ [WorkspaceManager] Cleanup complete: ${result.filesDeleted.length} files, ${result.sizeFreed} bytes freed`);

    return result;
  }

  /**
   * Clean up an entire workspace
   */
  async cleanupWorkspace(videoId: string): Promise<CleanupResult> {
    const rootDir = join(this.baseVideosDir, videoId);
    const result: CleanupResult = {
      filesDeleted: [],
      directoriesDeleted: [],
      sizeFreed: 0,
      errors: [],
    };

    try {
      // Calculate total size before deletion
      const totalSize = await this.getDirectorySize(rootDir);

      // Remove directory recursively
      await fs.rm(rootDir, { recursive: true, force: true });

      result.directoriesDeleted.push(rootDir);
      result.sizeFreed = totalSize;

      console.log(`🗑️ [WorkspaceManager] Deleted workspace: ${rootDir}`);
    }
    catch (error) {
      result.errors.push(`Failed to delete workspace: ${error}`);
    }

    return result;
  }

  /**
   * Get available disk space
   */
  async getAvailableSpace(path?: string): Promise<number> {
    const checkPath = path || this.baseVideosDir;
    try {
      const stats = await getStatfs(checkPath);
      return stats.bavail * stats.bsize;
    }
    catch (error) {
      console.error(`❌ [WorkspaceManager] Failed to get disk space:`, error);
      return 0;
    }
  }

  /**
   * Check if there's enough space for an operation
   */
  async hasEnoughSpace(requiredBytes: number, path?: string): Promise<boolean> {
    const available = await this.getAvailableSpace(path);
    const hasSpace = available > requiredBytes;

    if (!hasSpace) {
      console.warn(`⚠️ [WorkspaceManager] Insufficient space: ${available} < ${requiredBytes}`);
    }

    return hasSpace;
  }

  /**
   * Remove a file safely
   */
  async removeFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      console.log(`🗑️ [WorkspaceManager] Removed file: ${filePath}`);
    }
    catch (error) {
      if ((error as any).code !== 'ENOENT') {
        throw error;
      }
      // File doesn't exist, ignore
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    }
    catch {
      return false;
    }
  }

  /**
   * Get file size
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await fs.stat(filePath);
      return stats.size;
    }
    catch {
      return 0;
    }
  }

  /**
   * Read a file
   */
  async readFile(filePath: string): Promise<Buffer> {
    return fs.readFile(filePath);
  }

  /**
   * Write a file
   */
  async writeFile(filePath: string, data: Buffer | string): Promise<void> {
    await fs.writeFile(filePath, data);
    console.log(`💾 [WorkspaceManager] Wrote file: ${filePath}`);
  }

  /**
   * List files in a directory
   */
  async listFiles(dirPath: string, pattern?: string): Promise<string[]> {
    try {
      const files = await fs.readdir(dirPath);

      if (pattern) {
        const regex = new RegExp(pattern);
        return files.filter(file => regex.test(file));
      }

      return files;
    }
    catch {
      return [];
    }
  }

  /**
   * Create directories for a workspace
   */
  private async createDirectories(workspace: VideoWorkspace): Promise<void> {
    await fs.mkdir(workspace.rootDir, { recursive: true });
    await fs.mkdir(workspace.videoDir, { recursive: true });
    await fs.mkdir(workspace.audioDir, { recursive: true });
    await fs.mkdir(workspace.tempDir, { recursive: true });
  }

  /**
   * Get total size of a directory
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);

        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath);
        }
        else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    }
    catch {
      // Ignore errors
    }

    return totalSize;
  }
}

// Export singleton instance
export const workspaceManagerService = new WorkspaceManagerServiceImpl();
