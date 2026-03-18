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

describe('ingest legacy incoming video source', () => {
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

  test('maps legacy scan results into canonical ingest pending videos with hydrated createdAt dates', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-source-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await writeIncomingFile(storageDir, 'fixture-video.mp4');
    vi.resetModules();

    const { createIngestLegacyIncomingVideoSource } = await import('../../../app/composition/server/ingest-legacy-incoming-video-source');
    const source = createIngestLegacyIncomingVideoSource({
      logger: createLogger(),
      thumbnailGenerator: createThumbnailGenerator(),
    });

    const files = await source.scanIncomingVideos();

    expect(files).toHaveLength(1);
    expect(files[0]).toEqual(expect.objectContaining({
      filename: 'fixture-video.mp4',
      id: 'fixture-video',
      size: expect.any(Number),
      thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
      type: 'mp4',
    }));
    expect(files[0]?.createdAt).toBeInstanceOf(Date);
    expect(Object.keys(files[0] ?? {}).sort()).toEqual([
      'createdAt',
      'filename',
      'id',
      'size',
      'thumbnailUrl',
      'type',
    ]);
  });

  test('ignores unsupported files and nested directories under uploads', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-source-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await writeIncomingFile(storageDir, 'allowed-video.mp4');
    await writeIncomingFile(storageDir, 'ignored.txt', 'not-a-video');
    await mkdir(join(storageDir, 'uploads', 'nested'), { recursive: true });
    await writeIncomingFile(storageDir, 'nested/child-video.mp4');
    const thumbnailGenerator = createThumbnailGenerator();
    vi.resetModules();

    const { createIngestLegacyIncomingVideoSource } = await import('../../../app/composition/server/ingest-legacy-incoming-video-source');
    const source = createIngestLegacyIncomingVideoSource({
      logger: createLogger(),
      thumbnailGenerator,
    });

    const files = await source.scanIncomingVideos();

    expect(files).toEqual([
      expect.objectContaining({
        filename: 'allowed-video.mp4',
        id: 'allowed-video',
      }),
    ]);
    expect(thumbnailGenerator.generateThumbnail).toHaveBeenCalledOnce();
  });

  test('returns an empty successful collection when the uploads directory does not exist yet', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-source-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    vi.resetModules();

    const { createIngestLegacyIncomingVideoSource } = await import('../../../app/composition/server/ingest-legacy-incoming-video-source');
    const source = createIngestLegacyIncomingVideoSource({
      logger: createLogger(),
      thumbnailGenerator: createThumbnailGenerator(),
    });

    await expect(source.scanIncomingVideos()).resolves.toEqual([]);
  });

  test('keeps scanning when thumbnail generation fails for an individual file', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-source-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await writeIncomingFile(storageDir, 'first-video.mp4');
    await writeIncomingFile(storageDir, 'second-video.mov');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const generateThumbnail = vi.fn<ThumbnailGenerationPort['generateThumbnail']>(async ({ videoId }) => {
      if (videoId === 'first-video') {
        throw new Error('thumbnail failed');
      }

      return createSuccessfulThumbnailResult();
    });
    const thumbnailGenerator = createThumbnailGenerator(generateThumbnail);
    vi.resetModules();

    const { createIngestLegacyIncomingVideoSource } = await import('../../../app/composition/server/ingest-legacy-incoming-video-source');
    const source = createIngestLegacyIncomingVideoSource({
      logger: createLogger(),
      thumbnailGenerator,
    });

    const files = await source.scanIncomingVideos();

    expect(files.map(file => file.id).sort()).toEqual(['first-video', 'second-video']);
    expect(thumbnailGenerator.generateThumbnail).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});
