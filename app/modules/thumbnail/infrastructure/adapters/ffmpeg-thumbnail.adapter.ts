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
      if (!existsSync(inputPath)) {
        return Result.fail(new VideoNotFoundError(inputPath));
      }

      console.log(`🎬 [FFmpegThumbnailAdapter] Generating thumbnail for video ${videoId}`);
      console.log(`   Input: ${inputPath}`);
      console.log(`   Output: ${outputPath}`);

      const strategies: Array<'smart' | 'timestamp'> = useSmartScan
        ? ['smart', 'timestamp']
        : ['timestamp'];

      let lastError: ThumbnailGenerationError | Error | undefined;

      for (const strategy of strategies) {
        const usingSmartScan = strategy === 'smart';
        console.log(`   Method: ${usingSmartScan ? 'Smart scan' : `Timestamp ${timestamp}s`}`);

        const args = usingSmartScan
          ? this.buildSmartScanArgs(inputPath, outputPath)
          : this.buildTimestampArgs(inputPath, outputPath, timestamp);

        try {
          await spawnFFmpeg('ffmpeg', args);

          if (!existsSync(outputPath)) {
            console.warn(`⚠️ [FFmpegThumbnailAdapter] FFmpeg completed but no output file was produced (strategy: ${strategy})`);
            lastError = new ThumbnailExtractionFailedError('Output file was not created');
            continue;
          }

          const stats = await fs.stat(outputPath);

          console.log(`✅ [FFmpegThumbnailAdapter] Thumbnail generated successfully for video ${videoId}`);
          console.log(`   Size: ${stats.size} bytes`);

          return Result.ok({
            outputPath,
            fileSize: stats.size,
            extractedAtTimestamp: usingSmartScan ? undefined : timestamp,
            usedSmartScan: usingSmartScan,
          }) as Result<ThumbnailGenerationResult, ThumbnailGenerationError>;
        }
        catch (error) {
          console.error(`❌ [FFmpegThumbnailAdapter] Thumbnail generation failed (${strategy}) for video ${videoId}:`, error);

          lastError = error instanceof ThumbnailExtractionFailedError ? error : undefined;

          if (error instanceof Error) {
            const errorMessage = error.message.toLowerCase();

            if (errorMessage.includes('invalid data found') || errorMessage.includes('unknown format')) {
              return Result.fail(new UnsupportedVideoFormatError(inputPath, error));
            }

            if (errorMessage.includes('no space left') || errorMessage.includes('cannot allocate memory')) {
              return Result.fail(new InsufficientResourcesError(error));
            }

            if (!usingSmartScan) {
              return Result.fail(new ThumbnailExtractionFailedError(error.message, error));
            }

            // For smart scan failures, try the next strategy (timestamp fallback)
            continue;
          }

          if (!usingSmartScan) {
            return Result.fail(new ThumbnailExtractionFailedError('Unknown error during thumbnail generation'));
          }
        }
      }

      const fallbackError = lastError instanceof ThumbnailExtractionFailedError
        ? lastError
        : new ThumbnailExtractionFailedError('Thumbnail generation failed after all strategies');

      return Result.fail(fallbackError);
    }
    catch (error) {
      console.error(`❌ [FFmpegThumbnailAdapter] Unexpected thumbnail generation error for video ${videoId}:`, error);

      if (error instanceof Error) {
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
