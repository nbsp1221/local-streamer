import { existsSync, promises as fs } from 'fs';
import { ffmpeg } from '~/configs';
import { spawnFFmpeg } from '~/lib/ffmpeg-process-manager';
import { Result } from '~/lib/result';
import {
  type ThumbnailGenerationError,
  type ThumbnailGenerationPort,
  type ThumbnailGenerationRequest,
  type ThumbnailGenerationResult,
  InsufficientResourcesError,
  ThumbnailExtractionFailedError,
  UnsupportedVideoFormatError,
  VideoNotFoundError,
} from '../../application/ports/thumbnail-generation.port';

/**
 * FFmpeg-based implementation of ThumbnailGenerationPort.
 * This adapter translates business-level thumbnail generation requests
 * into FFmpeg-specific operations using the safe ffmpeg-process-manager.
 */
export class FFmpegThumbnailAdapter implements ThumbnailGenerationPort {
  /**
   * Generate a thumbnail from a video file using FFmpeg
   */
  async generateThumbnail(request: ThumbnailGenerationRequest): Promise<Result<ThumbnailGenerationResult, ThumbnailGenerationError>> {
    const { videoId, inputPath, outputPath, timestamp = 3, useSmartScan = true } = request;

    try {
      // Validate input file exists
      if (!existsSync(inputPath)) {
        return Result.fail(new VideoNotFoundError(inputPath));
      }

      console.log(`🎬 [FFmpegThumbnailAdapter] Generating thumbnail for video ${videoId}`);
      console.log(`   Input: ${inputPath}`);
      console.log(`   Output: ${outputPath}`);
      console.log(`   Method: ${useSmartScan ? 'Smart scan' : `Timestamp ${timestamp}s`}`);

      // Build FFmpeg arguments based on method
      const args = useSmartScan
        ? this.buildSmartScanArgs(inputPath, outputPath)
        : this.buildTimestampArgs(inputPath, outputPath, timestamp);

      // Execute FFmpeg command using the process manager
      await spawnFFmpeg('ffmpeg', args);

      // Verify output file was created and get stats
      if (!existsSync(outputPath)) {
        return Result.fail(new ThumbnailExtractionFailedError('Output file was not created'));
      }

      const stats = await fs.stat(outputPath);

      console.log(`✅ [FFmpegThumbnailAdapter] Thumbnail generated successfully for video ${videoId}`);
      console.log(`   Size: ${stats.size} bytes`);

      return Result.ok({
        outputPath,
        fileSize: stats.size,
        extractedAtTimestamp: timestamp,
        usedSmartScan: useSmartScan,
      }) as Result<ThumbnailGenerationResult, ThumbnailGenerationError>;
    }
    catch (error) {
      console.error(`❌ [FFmpegThumbnailAdapter] Thumbnail generation failed for video ${videoId}:`, error);

      if (error instanceof Error) {
        // Check for specific FFmpeg errors
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes('invalid data found') || errorMessage.includes('unknown format')) {
          return Result.fail(new UnsupportedVideoFormatError(inputPath, error));
        }

        if (errorMessage.includes('no space left') || errorMessage.includes('cannot allocate memory')) {
          return Result.fail(new InsufficientResourcesError(error));
        }

        return Result.fail(new ThumbnailExtractionFailedError(error.message, error));
      }

      return Result.fail(new ThumbnailExtractionFailedError('Unknown error during thumbnail generation'));
    }
  }

  /**
   * Check if thumbnail generation system is available
   */
  async isThumbnailGenerationAvailable(): Promise<boolean> {
    try {
      // Check if FFmpeg binary exists and is accessible
      if (!ffmpeg?.ffmpegPath) {
        console.warn('[FFmpegThumbnailAdapter] FFmpeg path not configured');
        return false;
      }

      if (!existsSync(ffmpeg.ffmpegPath)) {
        console.warn(`[FFmpegThumbnailAdapter] FFmpeg binary not found at: ${ffmpeg.ffmpegPath}`);
        return false;
      }

      return true;
    }
    catch (error) {
      console.error('[FFmpegThumbnailAdapter] Error checking availability:', error);
      return false;
    }
  }

  /**
   * Build FFmpeg arguments for timestamp-based thumbnail extraction
   */
  private buildTimestampArgs(inputPath: string, outputPath: string, timestamp: number): string[] {
    return [
      '-ss',
      timestamp.toString(), // Seek to timestamp
      '-i',
      inputPath, // Input file
      '-vframes',
      '1', // Extract single frame
      '-vf',
      'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2', // Scale to 640x360 with padding
      '-q:v',
      '2', // JPEG quality (2 = high quality)
      '-y', // Overwrite output file
      outputPath,
    ];
  }

  /**
   * Build FFmpeg arguments for smart scene detection-based thumbnail extraction
   */
  private buildSmartScanArgs(inputPath: string, outputPath: string): string[] {
    return [
      '-i',
      inputPath,
      '-vf',
      'select=\'gt(scene,0.3)\',scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2',
      '-frames:v',
      '1',
      '-vsync',
      'vfr',
      '-q:v',
      '2',
      '-y',
      outputPath,
    ];
  }
}
