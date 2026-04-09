import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { IngestUploadScanPort } from '~/modules/ingest/application/ports/ingest-upload-scan.port';
import { getIngestStoragePaths } from '../storage/ingest-storage-paths.server';

const SUPPORTED_VIDEO_FORMATS = new Set([
  '.mp4',
  '.avi',
  '.mkv',
  '.mov',
  '.webm',
  '.m4v',
  '.flv',
  '.wmv',
]);

interface LoggerLike {
  info(message: string, data?: unknown): void;
}

interface FilesystemIngestUploadScanAdapterDependencies {
  logger?: LoggerLike;
}

export class FilesystemIngestUploadScanAdapter implements IngestUploadScanPort {
  private readonly logger: LoggerLike;

  constructor(deps: FilesystemIngestUploadScanAdapterDependencies = {}) {
    this.logger = deps.logger ?? console;
  }

  async discoverUploads() {
    const { uploadsDir } = getIngestStoragePaths();

    this.logger.info('Starting to scan uploads directory for video files');
    await mkdir(uploadsDir, { recursive: true });
    this.logger.info('Uploads directory verified');

    const entries = await readdir(uploadsDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_VIDEO_FORMATS.has(ext)) {
        continue;
      }

      const filePath = path.join(uploadsDir, entry.name);
      const fileStat = await stat(filePath);
      files.push({
        createdAt: fileStat.birthtime || fileStat.mtime,
        filename: entry.name,
        id: path.parse(entry.name).name,
        size: fileStat.size,
        type: ext.substring(1),
      });
    }

    if (files.length === 0) {
      this.logger.info('No video files found in uploads directory');
    }
    else {
      this.logger.info(`Found ${files.length} video file(s) in uploads directory`, {
        count: files.length,
        files: files.map(file => ({
          filename: file.filename,
          size: file.size,
          type: file.type,
        })),
      });
    }

    return files;
  }
}
