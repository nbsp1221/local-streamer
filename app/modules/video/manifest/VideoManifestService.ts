import { join } from 'path';
import type { KeyManagementPort } from '~/modules/video/security/ports/key-management.port';
import { Result } from '~/lib/result';
import { Pbkdf2KeyManagerAdapter } from '~/modules/video/security/adapters/pbkdf2-key-manager.adapter';
import { workspaceManagerService } from '~/modules/video/storage/services/WorkspaceManagerService';
import type {
  ManifestAvailabilityResult,
  ManifestContentResult,
  ManifestErrorCode,
  SegmentValidationResult,
  VideoManifestService,
} from './manifest.types';
import { ManifestError } from './manifest.types';

export interface VideoManifestServiceDependencies {
  keyManager: KeyManagementPort;
}

/**
 * Video manifest service implementation
 * Provides read-only access to processed video manifests and segments
 * Uses WorkspaceManagerService for all file operations
 * Now uses dependency injection for clean architecture
 */
export class VideoManifestServiceImpl implements VideoManifestService {
  private keyManager: KeyManagementPort;

  constructor(private readonly deps: VideoManifestServiceDependencies) {
    this.keyManager = deps.keyManager;
  }

  /**
   * Check if a video manifest is available and ready for streaming
   * Verifies both manifest file and encryption key existence
   */
  async isManifestAvailable(videoId: string): Promise<ManifestAvailabilityResult> {
    try {
      console.log(`🔍 [VideoManifest] Checking availability for video: ${videoId}`);

      // Check if workspace exists
      const workspaceExists = await workspaceManagerService.workspaceExists(videoId);
      if (!workspaceExists) {
        console.log(`❌ [VideoManifest] Workspace not found for video: ${videoId}`);
        return { available: false, reason: 'workspace_not_found' };
      }

      // Get workspace and check manifest file
      const workspace = await workspaceManagerService.getWorkspace(videoId);
      const manifestExists = await workspaceManagerService.fileExists(workspace.manifestPath);

      if (!manifestExists) {
        console.log(`❌ [VideoManifest] Manifest file not found: ${workspace.manifestPath}`);
        return { available: false, reason: 'manifest_not_found' };
      }

      // Check if encryption key exists
      const hasKey = await this.keyManager.keyExists(videoId);
      if (!hasKey) {
        console.log(`❌ [VideoManifest] Encryption key not found for video: ${videoId}`);
        return { available: false, reason: 'key_not_found' };
      }

      console.log(`✅ [VideoManifest] Video available for streaming: ${videoId}`);
      return { available: true };
    }
    catch (error) {
      console.error(`❌ [VideoManifest] Error checking availability for ${videoId}:`, error);
      return { available: false, reason: 'workspace_not_found' };
    }
  }

  /**
   * Get DASH manifest content for a video
   * Returns manifest content with proper headers
   */
  async getManifestContent(videoId: string): Promise<Result<ManifestContentResult, ManifestError>> {
    try {
      console.log(`📄 [VideoManifest] Getting manifest content for video: ${videoId}`);

      // Check availability first
      const availability = await this.isManifestAvailable(videoId);
      if (!availability.available) {
        const errorCode = this.mapReasonToErrorCode(availability.reason!);
        const error = new ManifestError(
          `Video manifest not available: ${availability.reason}`,
          errorCode,
          videoId,
        );
        return Result.fail(error);
      }

      // Get workspace and read manifest file
      const workspace = await workspaceManagerService.getWorkspace(videoId);
      const manifestBuffer = await workspaceManagerService.readFile(workspace.manifestPath);
      const manifestContent = manifestBuffer.toString('utf-8');

      console.log(`✅ [VideoManifest] Successfully read manifest for video: ${videoId}`);

      const result: ManifestContentResult = {
        content: manifestContent,
        contentType: 'application/dash+xml',
        size: manifestBuffer.length,
      };

      return Result.ok(result) as Result<ManifestContentResult, ManifestError>;
    }
    catch (error) {
      console.error(`❌ [VideoManifest] Failed to read manifest for ${videoId}:`, error);
      const manifestError = new ManifestError(
        `Failed to read manifest: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'FILE_READ_ERROR',
        videoId,
      );
      return Result.fail(manifestError);
    }
  }

  /**
   * Validate segment name format and extract metadata
   * Supports DASH segment structure: video/init.mp4, video/segment-0001.m4s, audio/init.mp4, audio/segment-0001.m4s
   */
  validateSegmentName(segmentName: string): SegmentValidationResult {
    // Check for security vulnerabilities
    if (segmentName.includes('..') || segmentName.includes('\\') ||
      segmentName.startsWith('/') || segmentName.endsWith('/') ||
      segmentName.includes('\0')) {
      return { valid: false };
    }

    // Check for init segments: video/init.mp4 or audio/init.mp4
    const initMatch = segmentName.match(/^(video|audio)\/init\.mp4$/);
    if (initMatch) {
      return {
        valid: true,
        segmentType: 'init',
        streamType: initMatch[1] as 'video' | 'audio',
      };
    }

    // Check for media segments: video/segment-0001.m4s or audio/segment-0001.m4s
    const mediaMatch = segmentName.match(/^(video|audio)\/segment-(\d{4})\.m4s$/);
    if (mediaMatch) {
      return {
        valid: true,
        segmentType: 'media',
        streamType: mediaMatch[1] as 'video' | 'audio',
        segmentNumber: parseInt(mediaMatch[2], 10),
      };
    }

    return { valid: false };
  }

  /**
   * Get full path to a video segment file
   * Validates segment name and returns absolute path
   */
  async getSegmentPath(videoId: string, segmentName: string): Promise<Result<string, ManifestError>> {
    try {
      console.log(`📁 [VideoManifest] Getting segment path for ${videoId}/${segmentName}`);

      // Validate segment name format
      const validation = this.validateSegmentName(segmentName);
      if (!validation.valid) {
        console.error(`❌ [VideoManifest] Invalid segment name: ${segmentName}`);
        const error = new ManifestError(
          `Invalid segment name format: ${segmentName}`,
          'INVALID_SEGMENT_NAME',
          videoId,
          segmentName,
        );
        return Result.fail(error);
      }

      // Check if video workspace exists
      const workspaceExists = await workspaceManagerService.workspaceExists(videoId);
      if (!workspaceExists) {
        console.error(`❌ [VideoManifest] Workspace not found for video: ${videoId}`);
        const error = new ManifestError(
          `Video workspace not found: ${videoId}`,
          'VIDEO_NOT_FOUND',
          videoId,
          segmentName,
        );
        return Result.fail(error);
      }

      // Get workspace and construct segment path
      const workspace = await workspaceManagerService.getWorkspace(videoId);
      const segmentPath = join(workspace.rootDir, segmentName);

      // Verify segment file exists
      const segmentExists = await workspaceManagerService.fileExists(segmentPath);
      if (!segmentExists) {
        console.error(`❌ [VideoManifest] Segment file not found: ${segmentPath}`);
        const manifestError = new ManifestError(
          `Segment file not found: ${segmentName}`,
          'SEGMENT_NOT_FOUND',
          videoId,
          segmentName,
        );
        return Result.fail(manifestError);
      }

      console.log(`✅ [VideoManifest] Segment path resolved: ${segmentPath}`);
      return Result.ok(segmentPath) as Result<string, ManifestError>;
    }
    catch (error) {
      console.error(`❌ [VideoManifest] Error getting segment path for ${videoId}/${segmentName}:`, error);
      const manifestError = new ManifestError(
        `Failed to get segment path: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'WORKSPACE_ERROR',
        videoId,
        segmentName,
      );
      return Result.fail(manifestError);
    }
  }

  /**
   * Map availability reason to error code
   */
  private mapReasonToErrorCode(reason: string): ManifestErrorCode {
    switch (reason) {
      case 'manifest_not_found':
        return 'MANIFEST_NOT_FOUND';
      case 'key_not_found':
        return 'KEY_NOT_FOUND';
      case 'workspace_not_found':
        return 'VIDEO_NOT_FOUND';
      default:
        return 'WORKSPACE_ERROR';
    }
  }
}

// Export singleton instance with dependencies
const keyManager = new Pbkdf2KeyManagerAdapter();
export const videoManifestService = new VideoManifestServiceImpl({
  keyManager,
});
