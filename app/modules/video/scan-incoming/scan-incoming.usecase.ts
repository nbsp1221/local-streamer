import { promises as fs } from 'fs';
import { existsSync, statSync } from 'fs';
import path from 'path';
import type { PendingVideo } from '~/types/video';
import { config } from '~/configs';
import { InternalError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import type {
  ScanIncomingDependencies,
  ScanIncomingRequest,
  ScanIncomingResponse,
} from './scan-incoming.types';

export class ScanIncomingUseCase extends UseCase<ScanIncomingRequest, ScanIncomingResponse> {
  constructor(private readonly deps: ScanIncomingDependencies) {
    super();
  }

  async execute(_request: ScanIncomingRequest): Promise<Result<ScanIncomingResponse>> {
    const { thumbnailGenerator, logger } = this.deps;

    try {
      // 1. Log the start of scanning operation
      logger.info('Starting to scan uploads directory for video files');

      // 2. Ensure uploads directory exists
      await this.ensureUploadsDirectory();
      logger.info('Uploads directory verified');

      // 3. Scan for video files
      const files = await this.scanIncomingFiles(thumbnailGenerator);
      const fileCount = files.length;

      // 4. Log the results
      if (fileCount === 0) {
        logger.info('No video files found in uploads directory');
      }
      else {
        logger.info(`Found ${fileCount} video file(s) in uploads directory`, {
          count: fileCount,
          files: files.map(f => ({
            filename: f.filename,
            size: f.size,
            type: f.type,
          })),
        });
      }

      // 5. Return success result
      return Result.ok({
        files,
        count: fileCount,
      });
    }
    catch (error) {
      // 6. Handle and log any errors
      logger.error('Failed to scan uploads files', error);

      return Result.fail(
        new InternalError('Failed to scan uploads files'),
      );
    }
  }

  /**
   * Ensure uploads directory exists
   */
  private async ensureUploadsDirectory(): Promise<void> {
    if (!existsSync(config.paths.uploads)) {
      await fs.mkdir(config.paths.uploads, { recursive: true });
    }
  }

  /**
   * Scan uploads directory for video files and generate thumbnails
   */
  private async scanIncomingFiles(thumbnailGenerator: any): Promise<PendingVideo[]> {
    const uploadsDir = config.paths.uploads;

    // Create thumbnails directory if it doesn't exist
    if (!existsSync(config.paths.thumbnails)) {
      await fs.mkdir(config.paths.thumbnails, { recursive: true });
    }

    // Read directory contents
    if (!existsSync(uploadsDir)) {
      return [];
    }

    const files = await fs.readdir(uploadsDir);
    const pendingVideos: PendingVideo[] = [];

    for (const filename of files) {
      const filePath = path.join(uploadsDir, filename);
      const stat = statSync(filePath);

      // Check if it's a file (exclude directories)
      if (!stat.isFile()) continue;

      // Check if it's a supported video format
      const ext = path.extname(filename).toLowerCase();
      if (!config.constants.supportedVideoFormats.includes(ext)) continue;

      // Generate thumbnail
      const nameWithoutExt = path.parse(filename).name;
      const thumbnailPath = path.join(config.paths.thumbnails, `${nameWithoutExt}.jpg`);

      try {
        await thumbnailGenerator.generateThumbnail({
          videoId: nameWithoutExt,
          inputPath: filePath,
          outputPath: thumbnailPath,
          timestamp: 3,
          useSmartScan: true,
        });
      }
      catch (thumbnailError) {
        console.warn(`⚠️ Thumbnail generation failed for ${filename}:`, thumbnailError);
      }

      // Create PendingVideo object
      const pendingVideo: PendingVideo = {
        id: nameWithoutExt, // Use filename without extension as ID
        filename,
        size: stat.size,
        type: ext.substring(1), // Remove the leading dot
        thumbnailUrl: `/api/thumbnail-preview/${nameWithoutExt}.jpg`,
        createdAt: stat.birthtime || stat.mtime,
      };

      pendingVideos.push(pendingVideo);
    }

    return pendingVideos;
  }
}
