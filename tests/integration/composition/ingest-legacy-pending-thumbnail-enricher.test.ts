import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Result } from '~/legacy/lib/result';
import type {
  ThumbnailGenerationError,
  ThumbnailGenerationPort,
  ThumbnailGenerationResult,
} from '~/legacy/modules/thumbnail/application/ports/thumbnail-generation.port';

function createSuccessfulThumbnailResult(): Result<ThumbnailGenerationResult, ThumbnailGenerationError> {
  return {
    success: true,
    data: {
      extractedAtTimestamp: 3,
      fileSize: 128,
      outputPath: '/tmp/thumb.jpg',
      usedSmartScan: true,
    },
  };
}

async function writeIncomingFile(storageDir: string, relativePath: string, contents = 'video-fixture') {
  const targetPath = join(storageDir, 'uploads', relativePath);
  await mkdir(join(targetPath, '..'), { recursive: true });
  await writeFile(targetPath, contents, 'utf8');
}

function createThumbnailGenerator(
  implementation?: ThumbnailGenerationPort['generateThumbnail'],
): ThumbnailGenerationPort {
  const generateThumbnail = implementation ??
    vi.fn<ThumbnailGenerationPort['generateThumbnail']>(async () => createSuccessfulThumbnailResult());

  return {
    generateThumbnail,
    isThumbnailGenerationAvailable: vi.fn(async () => true),
  };
}

function createLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

describe('ingest legacy pending thumbnail enricher', () => {
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
    }
  });

  test('enriches discovered uploads into canonical pending videos with thumbnail urls', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-enricher-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await writeIncomingFile(storageDir, 'fixture-video.mp4');
    const thumbnailGenerator = createThumbnailGenerator();
    vi.resetModules();

    const { createIngestLegacyPendingThumbnailEnricher } = await import('../../../app/composition/server/ingest-legacy-pending-thumbnail-enricher');
    const enricher = createIngestLegacyPendingThumbnailEnricher({
      logger: createLogger(),
      thumbnailGenerator,
    });

    const files = await enricher.enrichPendingUploads([
      {
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        filename: 'fixture-video.mp4',
        id: 'fixture-video',
        size: 1_024,
        type: 'mp4',
      },
    ]);

    expect(files).toEqual([
      expect.objectContaining({
        filename: 'fixture-video.mp4',
        id: 'fixture-video',
        size: 1_024,
        thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
        type: 'mp4',
      }),
    ]);
    expect(files[0]?.createdAt).toBeInstanceOf(Date);
    expect(thumbnailGenerator.generateThumbnail).toHaveBeenCalledOnce();
  });

  test('keeps enriching when thumbnail generation fails for an individual file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-enricher-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await writeIncomingFile(storageDir, 'first-video.mp4');
    await writeIncomingFile(storageDir, 'second-video.mov');
    const generateThumbnail = vi.fn<ThumbnailGenerationPort['generateThumbnail']>(async ({ videoId }) => {
      if (videoId === 'first-video') {
        throw new Error('thumbnail failed');
      }

      return createSuccessfulThumbnailResult();
    });
    const thumbnailGenerator = createThumbnailGenerator(generateThumbnail);
    const logger = createLogger();
    vi.resetModules();

    const { createIngestLegacyPendingThumbnailEnricher } = await import('../../../app/composition/server/ingest-legacy-pending-thumbnail-enricher');
    const enricher = createIngestLegacyPendingThumbnailEnricher({
      logger,
      thumbnailGenerator,
    });

    const files = await enricher.enrichPendingUploads([
      {
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        filename: 'first-video.mp4',
        id: 'first-video',
        size: 1_024,
        type: 'mp4',
      },
      {
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        filename: 'second-video.mov',
        id: 'second-video',
        size: 2_048,
        type: 'mov',
      },
    ]);

    expect(files.map(file => file.id).sort()).toEqual(['first-video', 'second-video']);
    expect(thumbnailGenerator.generateThumbnail).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledOnce();
  });
});
