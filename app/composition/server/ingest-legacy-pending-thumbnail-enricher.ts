import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import type { ThumbnailGenerationPort } from '~/legacy/modules/thumbnail/application/ports/thumbnail-generation.port';
import type { ScanIncomingDependencies } from '~/legacy/modules/video/scan-incoming/scan-incoming.types';
import type { IngestPendingThumbnailEnricherPort } from '~/modules/ingest/application/ports/ingest-pending-thumbnail-enricher.port';
import type { DiscoveredIngestUpload } from '~/modules/ingest/application/ports/ingest-upload-scan.port';
import { config } from '~/legacy/configs';
import { FFmpegThumbnailAdapter } from '~/legacy/modules/thumbnail/infrastructure/adapters/ffmpeg-thumbnail.adapter';

type IngestLegacyPendingThumbnailEnricherDependencies =
  & Pick<ScanIncomingDependencies, 'logger'>
  & { thumbnailGenerator: ThumbnailGenerationPort };

function createPendingThumbnailEnricherDependencies(
  overrides: Partial<IngestLegacyPendingThumbnailEnricherDependencies>,
): IngestLegacyPendingThumbnailEnricherDependencies {
  return {
    logger: overrides.logger ?? console,
    thumbnailGenerator: overrides.thumbnailGenerator ?? new FFmpegThumbnailAdapter(),
  };
}

async function ensureThumbnailsDirectory(): Promise<void> {
  if (!existsSync(config.paths.thumbnails)) {
    await fs.mkdir(config.paths.thumbnails, { recursive: true });
  }
}

async function enrichPendingUpload(
  file: DiscoveredIngestUpload,
  deps: IngestLegacyPendingThumbnailEnricherDependencies,
) {
  const inputPath = path.join(config.paths.uploads, file.filename);
  const outputPath = path.join(config.paths.thumbnails, `${file.id}.jpg`);

  try {
    await deps.thumbnailGenerator.generateThumbnail({
      videoId: file.id,
      inputPath,
      outputPath,
      timestamp: 3,
      useSmartScan: true,
    });
  }
  catch (error) {
    deps.logger.warn(`Thumbnail generation failed for ${file.filename}`, error);
  }

  return {
    ...file,
    createdAt: file.createdAt instanceof Date ? file.createdAt : new Date(file.createdAt),
    thumbnailUrl: `/api/thumbnail-preview/${file.id}.jpg`,
  };
}

export function createIngestLegacyPendingThumbnailEnricher(
  overrides: Partial<IngestLegacyPendingThumbnailEnricherDependencies> = {},
): IngestPendingThumbnailEnricherPort {
  const deps = createPendingThumbnailEnricherDependencies(overrides);

  return {
    async enrichPendingUploads(files) {
      await ensureThumbnailsDirectory();

      return Promise.all(files.map(file => enrichPendingUpload(file, deps)));
    },
  };
}
