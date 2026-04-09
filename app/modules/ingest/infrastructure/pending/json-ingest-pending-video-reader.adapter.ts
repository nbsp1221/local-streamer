import { readFile } from 'node:fs/promises';
import type { IngestPendingVideoReaderPort } from '~/modules/ingest/application/ports/ingest-pending-video-reader.port';
import type { IngestPendingVideo } from '~/modules/ingest/domain/ingest-pending-video';
import { getIngestStoragePaths } from '../storage/ingest-storage-paths.server';

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

interface PendingVideoRecord {
  createdAt?: Date | string;
  filename: string;
  id: string;
  size: number;
  thumbnailUrl?: string;
  type: string;
}

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

function toIngestPendingVideo(item: PendingVideoRecord): IngestPendingVideo {
  return {
    createdAt: item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt ?? 0),
    filename: item.filename,
    id: item.id,
    size: item.size,
    thumbnailUrl: item.thumbnailUrl,
    type: normalizePendingType(item.type),
  };
}

export class JsonIngestPendingVideoReaderAdapter implements IngestPendingVideoReaderPort {
  async readPendingUploads(): Promise<IngestPendingVideo[]> {
    const { pendingJsonPath } = getIngestStoragePaths();

    let parsed: unknown;

    try {
      parsed = JSON.parse(await readFile(pendingJsonPath, 'utf8'));
    }
    catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return [];
      }

      throw error;
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Pending uploads data must be an array');
    }

    return parsed.map(item => toIngestPendingVideo(item as PendingVideoRecord));
  }
}
