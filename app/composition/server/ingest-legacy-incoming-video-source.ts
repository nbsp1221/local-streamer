import type { ScanIncomingDependencies } from '~/legacy/modules/video/scan-incoming/scan-incoming.types';
import type { IngestIncomingVideoSourcePort } from '~/modules/ingest/application/ports/ingest-incoming-video-source.port';
import type { IngestPendingVideo } from '~/modules/ingest/domain/ingest-pending-video';
import { FFmpegThumbnailAdapter } from '~/legacy/modules/thumbnail/infrastructure/adapters/ffmpeg-thumbnail.adapter';
import { ScanIncomingUseCase } from '~/legacy/modules/video/scan-incoming/scan-incoming.usecase';

type IngestLegacyIncomingVideoSourceDependencies = Partial<ScanIncomingDependencies>;

function createScanIncomingDependencies(
  overrides: IngestLegacyIncomingVideoSourceDependencies,
): ScanIncomingDependencies {
  return {
    thumbnailGenerator: overrides.thumbnailGenerator ?? new FFmpegThumbnailAdapter(),
    logger: overrides.logger ?? console,
  };
}

function toCanonicalPendingVideo(file: {
  id: string;
  filename: string;
  size: number;
  type: string;
  thumbnailUrl?: string;
  createdAt?: Date | string;
}): IngestPendingVideo {
  return {
    createdAt: file.createdAt instanceof Date ? file.createdAt : new Date(file.createdAt ?? 0),
    filename: file.filename,
    id: file.id,
    size: file.size,
    thumbnailUrl: file.thumbnailUrl,
    type: file.type,
  };
}

export function createIngestLegacyIncomingVideoSource(
  overrides: IngestLegacyIncomingVideoSourceDependencies = {},
): IngestIncomingVideoSourcePort {
  const deps = createScanIncomingDependencies(overrides);

  return {
    async scanIncomingVideos() {
      const useCase = new ScanIncomingUseCase(deps);
      const result = await useCase.execute({});

      if (!result.success) {
        throw result.error;
      }

      return result.data.files.map(toCanonicalPendingVideo);
    },
  };
}
