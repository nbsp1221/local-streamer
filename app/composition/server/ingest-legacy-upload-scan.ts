import { promises as fs } from 'node:fs';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ScanIncomingDependencies } from '~/legacy/modules/video/scan-incoming/scan-incoming.types';
import type { IngestUploadScanPort } from '~/modules/ingest/application/ports/ingest-upload-scan.port';
import { config } from '~/legacy/configs';

type IngestLegacyUploadScanDependencies = Pick<ScanIncomingDependencies, 'logger'>;

function createUploadScanDependencies(
  overrides: Partial<IngestLegacyUploadScanDependencies>,
): IngestLegacyUploadScanDependencies {
  return {
    logger: overrides.logger ?? console,
  };
}

async function ensureUploadsDirectory(): Promise<void> {
  if (!existsSync(config.paths.uploads)) {
    await fs.mkdir(config.paths.uploads, { recursive: true });
  }
}

export function createIngestLegacyUploadScan(
  overrides: Partial<IngestLegacyUploadScanDependencies> = {},
): IngestUploadScanPort {
  const deps = createUploadScanDependencies(overrides);

  return {
    async discoverUploads() {
      deps.logger.info('Starting to scan uploads directory for video files');
      await ensureUploadsDirectory();
      deps.logger.info('Uploads directory verified');

      if (!existsSync(config.paths.uploads)) {
        return [];
      }

      const entries = await fs.readdir(config.paths.uploads);
      const files = [];

      for (const filename of entries) {
        const filePath = path.join(config.paths.uploads, filename);
        const stat = statSync(filePath);

        if (!stat.isFile()) continue;

        const ext = path.extname(filename).toLowerCase();
        if (!config.constants.supportedVideoFormats.includes(ext)) continue;

        files.push({
          createdAt: stat.birthtime || stat.mtime,
          filename,
          id: path.parse(filename).name,
          size: stat.size,
          type: ext.substring(1),
        });
      }

      if (files.length === 0) {
        deps.logger.info('No video files found in uploads directory');
      }
      else {
        deps.logger.info(`Found ${files.length} video file(s) in uploads directory`, {
          count: files.length,
          files: files.map(file => ({
            filename: file.filename,
            size: file.size,
            type: file.type,
          })),
        });
      }

      return files;
    },
  };
}
