import { Result } from '~/lib/result';
import type {
  EncryptionSetupError,
  ManifestCreationError,
  PackageValidationError,
  PackagingError,
  PackagingFailedError,
  PackagingRequest,
  PackagingResult,
  PackagingSystemUnavailableError,
  SecurityLevel,
  StreamingOptimization,
  ValidationResult,
  VideoPackagingPort,
} from '../../application/ports/video-packaging.port';
import type { EncryptionConfig, PackagingRequest as TechnicalPackagingRequest } from '../../processing/types/shaka-packager.types';
import type { ShakaPackagerService } from '../../processing/types/shaka-packager.types';
import {
  EncryptionSetupError as PortEncryptionSetupError,
  ManifestCreationError as PortManifestCreationError,
  PackageValidationError as PortPackageValidationError,
  PackagingFailedError as PortPackagingFailedError,
  PackagingSystemUnavailableError as PortPackagingSystemUnavailableError,
} from '../../application/ports/video-packaging.port';

/**
 * Adapter that implements the business-focused VideoPackagingPort
 * by delegating to the technical ShakaPackagerService implementation.
 */
export class VideoPackagingAdapter implements VideoPackagingPort {
  constructor(
    private readonly packagerService: ShakaPackagerService,
    private readonly keyManager: { generateKeyPair: () => { key: string; keyId: string } },
  ) {}

  /**
   * Package a transcoded video into secure streamable format
   */
  async packageVideoForStreaming(request: PackagingRequest): Promise<Result<PackagingResult, PackagingError>> {
    try {
      // Check if packaging system is available
      const isAvailable = await this.packagerService.isAvailable();
      if (!isAvailable) {
        return Result.fail(new PortPackagingSystemUnavailableError(request.videoId, 'Shaka Packager not available'));
      }

      // Generate encryption configuration
      const encryptionConfig = this.createEncryptionConfig(request.securityLevel, request.videoId);
      if (!encryptionConfig.success) {
        return Result.fail(encryptionConfig.error);
      }

      // Map business request to technical request
      const technicalRequest = this.mapToTechnicalRequest(request, encryptionConfig.data);

      // Execute packaging
      const technicalResult = await this.packagerService.package(technicalRequest);

      // Map technical result to business result
      const businessResult: PackagingResult = {
        videoId: request.videoId,
        manifestPath: technicalResult.manifestPath,
        keyPath: `${request.outputDirectory}/key.bin`,
        totalSegments: technicalResult.segmentCount,
        packagedSize: await this.calculatePackagedSize(request.outputDirectory),
        processingDurationSeconds: Math.round(technicalResult.duration / 1000),
        streamingReady: true, // If we get here, it's ready
      };

      return Result.ok(businessResult) as Result<PackagingResult, PackagingError>;
    }
    catch (error) {
      if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Map technical errors to business errors
        if (message.includes('manifest') || message.includes('mpd')) {
          return Result.fail(new PortManifestCreationError(request.videoId, error.message));
        }

        if (message.includes('encrypt') || message.includes('key') || message.includes('drm')) {
          return Result.fail(new PortEncryptionSetupError(request.videoId, error.message));
        }

        return Result.fail(new PortPackagingFailedError(request.videoId, error.message, request.transcodedVideoPath));
      }

      return Result.fail(new PortPackagingFailedError(request.videoId, 'Unknown error', request.transcodedVideoPath));
    }
  }

  /**
   * Check if packaging system is available and ready
   */
  async isPackagingAvailable(): Promise<boolean> {
    try {
      return await this.packagerService.isAvailable();
    }
    catch {
      return false;
    }
  }

  /**
   * Validate that a packaged video is ready for streaming
   */
  async validatePackagedVideo(videoId: string, packagedDir: string): Promise<Result<ValidationResult, PackagingError>> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      const manifestPath = path.join(packagedDir, 'manifest.mpd');
      const keyPath = path.join(packagedDir, 'key.bin');
      const videoDir = path.join(packagedDir, 'video');
      const audioDir = path.join(packagedDir, 'audio');

      const issues: string[] = [];
      let manifestValid = false;
      let encryptionValid = false;
      let segmentsComplete = false;

      // Check manifest
      try {
        await fs.access(manifestPath);
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        manifestValid = manifestContent.includes('<MPD') && manifestContent.includes('</MPD>');
        if (!manifestValid) {
          issues.push('Manifest file is invalid or corrupted');
        }
      }
      catch {
        issues.push('Manifest file not found or inaccessible');
      }

      // Check encryption key
      try {
        await fs.access(keyPath);
        const keyStats = await fs.stat(keyPath);
        encryptionValid = keyStats.size === 16; // AES-128 key should be 16 bytes
        if (!encryptionValid) {
          issues.push('Encryption key file is invalid size');
        }
      }
      catch {
        issues.push('Encryption key file not found');
      }

      // Check segments
      try {
        const videoSegments = await this.packagerService.listSegments(videoDir);
        const audioSegments = await this.packagerService.listSegments(audioDir);
        segmentsComplete = videoSegments.length > 0 && audioSegments.length > 0;
        if (!segmentsComplete) {
          issues.push('Video or audio segments are missing');
        }
      }
      catch {
        issues.push('Unable to verify segment files');
      }

      const validationResult: ValidationResult = {
        isValid: manifestValid && encryptionValid && segmentsComplete,
        manifestValid,
        encryptionValid,
        segmentsComplete,
        issues,
      };

      return Result.ok(validationResult) as Result<ValidationResult, PackagingError>;
    }
    catch (error) {
      if (error instanceof Error) {
        return Result.fail(new PortPackageValidationError(videoId, [error.message]));
      }
      return Result.fail(new PortPackageValidationError(videoId, ['Unknown validation error']));
    }
  }

  /**
   * Create encryption configuration based on security level
   */
  private createEncryptionConfig(securityLevel: SecurityLevel, videoId: string): Result<EncryptionConfig, PackagingError> {
    try {
      const keyPair = this.keyManager.generateKeyPair();

      const encryptionConfig: EncryptionConfig = {
        scheme: securityLevel === 'enhanced' ? 'cbcs' : 'cenc',
        key: keyPair.key,
        keyId: keyPair.keyId,
        drmLabel: 'CENC',
      };

      return Result.ok(encryptionConfig) as Result<EncryptionConfig, PackagingError>;
    }
    catch (error) {
      if (error instanceof Error) {
        return Result.fail(new PortEncryptionSetupError(videoId, error.message));
      }
      return Result.fail(new PortEncryptionSetupError(videoId, 'Failed to generate encryption keys'));
    }
  }

  /**
   * Map business request to technical request
   */
  private mapToTechnicalRequest(request: PackagingRequest, encryptionConfig: EncryptionConfig): TechnicalPackagingRequest {
    return {
      videoId: request.videoId,
      inputPath: request.transcodedVideoPath,
      outputDir: request.outputDirectory,
      encryption: encryptionConfig,
      segmentDuration: request.streamingOptimization.segmentDurationSeconds,
      staticLiveMpd: !request.streamingOptimization.liveStreamingCompatible,
    };
  }

  /**
   * Calculate total size of packaged content
   */
  private async calculatePackagedSize(directory: string): Promise<number> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');

      let totalSize = 0;

      const calculateDirSize = async (dirPath: string): Promise<number> => {
        let size = 0;
        try {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
              size += await calculateDirSize(fullPath);
            }
            else {
              const stats = await fs.stat(fullPath);
              size += stats.size;
            }
          }
        }
        catch {
          // Ignore errors
        }
        return size;
      };

      totalSize = await calculateDirSize(directory);
      return totalSize;
    }
    catch {
      return 0;
    }
  }
}
