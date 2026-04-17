import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { IngestPendingThumbnailEnricherPort } from '~/modules/ingest/application/ports/ingest-pending-thumbnail-enricher.port';
import type { DiscoveredIngestUpload } from '~/modules/ingest/application/ports/ingest-upload-scan.port';
import type { FFmpegProcessResult } from '~/shared/lib/server/ffmpeg-process-manager.server';
import { executeFFmpegCommand } from '~/shared/lib/server/ffmpeg-process-manager.server';
import { getIngestStoragePaths } from '../storage/ingest-storage-paths.server';

interface LoggerLike {
  warn(message: string, error?: unknown): void;
}

interface FfmpegIngestPendingThumbnailEnricherAdapterDependencies {
  executeFFmpegCommand?: (input: {
    args: string[];
    command: string;
  }) => Promise<FFmpegProcessResult>;
  logger?: LoggerLike;
}

function buildSmartScanArgs(inputPath: string, outputPath: string): string[] {
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

function buildTimestampArgs(inputPath: string, outputPath: string, timestamp = 1): string[] {
  return [
    '-ss',
    String(timestamp),
    '-i',
    inputPath,
    '-vframes',
    '1',
    '-vf',
    'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2',
    '-q:v',
    '2',
    '-y',
    outputPath,
  ];
}

async function ensureThumbnailOutput(outputPath: string) {
  await access(outputPath);
}

export class FfmpegIngestPendingThumbnailEnricherAdapter implements IngestPendingThumbnailEnricherPort {
  private readonly executeFFmpegCommand: NonNullable<FfmpegIngestPendingThumbnailEnricherAdapterDependencies['executeFFmpegCommand']>;
  private readonly logger: LoggerLike;

  constructor(deps: FfmpegIngestPendingThumbnailEnricherAdapterDependencies = {}) {
    this.executeFFmpegCommand = deps.executeFFmpegCommand ?? executeFFmpegCommand;
    this.logger = deps.logger ?? console;
  }

  async enrichPendingUploads(files: DiscoveredIngestUpload[]) {
    const { thumbnailsDir, uploadsDir } = getIngestStoragePaths();
    await mkdir(thumbnailsDir, { recursive: true });

    return Promise.all(files.map(async (file) => {
      const inputPath = path.join(uploadsDir, file.filename);
      const outputPath = path.join(thumbnailsDir, `${file.id}.jpg`);

      try {
        await this.executeFFmpegCommand({
          args: buildSmartScanArgs(inputPath, outputPath),
          command: 'ffmpeg',
        });
        await ensureThumbnailOutput(outputPath);
      }
      catch (smartScanError) {
        try {
          await this.executeFFmpegCommand({
            args: buildTimestampArgs(inputPath, outputPath),
            command: 'ffmpeg',
          });
          await ensureThumbnailOutput(outputPath);
        }
        catch (timestampError) {
          this.logger.warn(
            `Thumbnail generation failed for ${file.filename}`,
            timestampError instanceof Error ? timestampError : smartScanError,
          );
        }
      }

      return {
        ...file,
        createdAt: file.createdAt instanceof Date ? file.createdAt : new Date(file.createdAt),
        thumbnailUrl: `/api/thumbnail-preview/${file.id}.jpg`,
      };
    }));
  }
}
