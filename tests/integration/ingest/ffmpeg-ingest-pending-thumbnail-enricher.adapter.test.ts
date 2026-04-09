import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path, { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

async function writeIncomingFile(storageDir: string, relativePath: string, contents = 'video-fixture') {
  const targetPath = join(storageDir, 'uploads', relativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, contents, 'utf8');
}

function createDiscoveredUpload(overrides: Partial<{
  createdAt: Date;
  filename: string;
  id: string;
  size: number;
  type: string;
}> = {}) {
  return {
    createdAt: new Date('2026-04-07T00:00:00.000Z'),
    filename: 'fixture-video.mp4',
    id: 'fixture-video',
    size: 1024,
    type: 'mp4',
    ...overrides,
  };
}

function createLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

describe('FfmpegIngestPendingThumbnailEnricherAdapter', () => {
  let tempDir = '';
  let previousStorageDir: string | undefined;

  afterEach(async () => {
    if (previousStorageDir === undefined) {
      delete process.env.STORAGE_DIR;
    }
    else {
      process.env.STORAGE_DIR = previousStorageDir;
    }

    vi.resetModules();
    vi.restoreAllMocks();

    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
      tempDir = '';
    }
  });

  test('enriches discovered uploads, writes preview thumbnails to the shared thumbnails path, and keeps them readable through thumbnail composition', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-thumbnail-enricher-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await writeIncomingFile(storageDir, 'fixture-video.mp4');

    const executeFFmpegCommand = vi.fn(async ({ args }: { args: string[] }) => {
      const outputPath = args[args.length - 1];
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      return { exitCode: 0, stderr: '', stdout: '' };
    });

    const { FfmpegIngestPendingThumbnailEnricherAdapter } = await import('../../../app/modules/ingest/infrastructure/thumbnail/ffmpeg-ingest-pending-thumbnail-enricher.adapter');
    const enricher = new FfmpegIngestPendingThumbnailEnricherAdapter({
      executeFFmpegCommand,
      logger: createLogger(),
    });
    const files = await enricher.enrichPendingUploads([createDiscoveredUpload()]);

    expect(files).toEqual([
      expect.objectContaining({
        id: 'fixture-video',
        thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
      }),
    ]);
    expect(files[0]?.createdAt).toBeInstanceOf(Date);

    const { loadThumbnailPreviewResponse } = await import('../../../app/composition/server/thumbnails');
    const previewResponse = await loadThumbnailPreviewResponse({
      filename: 'fixture-video.jpg',
    });

    expect(previewResponse.status).toBe(200);
    expect(Buffer.from(await previewResponse.arrayBuffer()).length).toBe(4);
  });

  test('continues enriching when thumbnail generation fails for one file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-thumbnail-enricher-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await writeIncomingFile(storageDir, 'first-video.mp4');
    await writeIncomingFile(storageDir, 'second-video.mov');
    const logger = createLogger();
    const executeFFmpegCommand = vi.fn(async ({ args }: { args: string[] }) => {
      const outputPath = args[args.length - 1];
      if (outputPath.endsWith('first-video.jpg')) {
        throw new Error('thumbnail failed');
      }
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));
      return { exitCode: 0, stderr: '', stdout: '' };
    });

    const { FfmpegIngestPendingThumbnailEnricherAdapter } = await import('../../../app/modules/ingest/infrastructure/thumbnail/ffmpeg-ingest-pending-thumbnail-enricher.adapter');
    const enricher = new FfmpegIngestPendingThumbnailEnricherAdapter({
      executeFFmpegCommand,
      logger,
    });
    const files = await enricher.enrichPendingUploads([
      createDiscoveredUpload({ filename: 'first-video.mp4', id: 'first-video' }),
      createDiscoveredUpload({ filename: 'second-video.mov', id: 'second-video', type: 'mov' }),
    ]);

    expect(files.map(file => file.id).sort()).toEqual(['first-video', 'second-video']);
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
