import type { IngestPendingVideoReaderPort } from '~/modules/ingest/application/ports/ingest-pending-video-reader.port';
import type { IngestPendingVideo } from '~/modules/ingest/domain/ingest-pending-video';
import { getPendingVideoRepository } from '~/legacy/repositories';

const extensionMimeTypes: Record<string, string> = {
  avi: 'video/x-msvideo',
  flv: 'video/x-flv',
  m4v: 'video/mp4',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  webm: 'video/webm',
  wmv: 'video/x-ms-wmv',
};

function normalizePendingType(type: string): string {
  const normalized = type.trim().toLowerCase();

  if (!normalized) {
    return 'application/octet-stream';
  }

  if (normalized.includes('/')) {
    return normalized;
  }

  return extensionMimeTypes[normalized] ?? `video/${normalized}`;
}

function toIngestPendingVideo(item: {
  createdAt?: Date | string;
  filename: string;
  id: string;
  size: number;
  thumbnailUrl?: string;
  type: string;
}): IngestPendingVideo {
  return {
    createdAt: item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt ?? 0),
    filename: item.filename,
    id: item.id,
    size: item.size,
    thumbnailUrl: item.thumbnailUrl,
    type: normalizePendingType(item.type),
  };
}

export function createIngestLegacyPendingVideoSource(): IngestPendingVideoReaderPort {
  return {
    async readPendingUploads() {
      const pendingVideos = await getPendingVideoRepository().findAll();

      return pendingVideos.map(toIngestPendingVideo);
    },
  };
}
