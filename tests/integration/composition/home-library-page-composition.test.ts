import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { IngestPendingVideo } from '../../../app/modules/ingest/domain/ingest-pending-video';
import type { LibraryVideo } from '../../../app/modules/library/domain/library-video';

function createFixtureVideo(overrides: Partial<LibraryVideo> = {}): LibraryVideo {
  return {
    createdAt: new Date('2026-03-11T00:00:00.000Z'),
    duration: 180,
    id: 'video-1',
    tags: ['Action'],
    title: 'Catalog Fixture',
    videoUrl: '/videos/video-1/manifest.mpd',
    ...overrides,
  };
}

function createPendingFixture(overrides: Partial<IngestPendingVideo> = {}): IngestPendingVideo {
  return {
    createdAt: new Date('2026-03-29T00:00:00.000Z'),
    filename: 'pending.mp4',
    id: 'pending-1',
    size: 128,
    thumbnailUrl: '/api/thumbnail-preview/pending.jpg',
    type: 'video/mp4',
    ...overrides,
  };
}

describe('home library page composition root', () => {
  let tempDir = '';
  let previousStorageDir: string | undefined;
  let previousVideoMasterEncryptionSeed: string | undefined;

  afterEach(async () => {
    if (previousStorageDir === undefined) {
      delete process.env.STORAGE_DIR;
    }
    else {
      process.env.STORAGE_DIR = previousStorageDir;
    }

    if (previousVideoMasterEncryptionSeed === undefined) {
      delete process.env.VIDEO_MASTER_ENCRYPTION_SEED;
    }
    else {
      process.env.VIDEO_MASTER_ENCRYPTION_SEED = previousVideoMasterEncryptionSeed;
    }

    vi.resetModules();

    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
      tempDir = '';
    }
  });

  test('composes canonical library data with pending uploads loaded through ingest services', async () => {
    const { createHomeLibraryPageServices } = await import('../../../app/composition/server/home-library-page');
    const services = createHomeLibraryPageServices({
      ingestServices: {
        loadPendingUploadSnapshot: {
          execute: vi.fn(async () => ({
            ok: true as const,
            data: {
              count: 1,
              files: [createPendingFixture()],
            },
          })),
        },
      },
      libraryServices: {
        loadLibraryCatalogSnapshot: {
          execute: vi.fn(async () => ({
            ok: true as const,
            data: {
              filters: {
                displayQuery: ' Action ',
                normalizedQuery: 'action',
                normalizedTags: ['action', 'drama'],
                rawTags: ['Action', 'Drama'],
              },
              videos: [createFixtureVideo()],
            },
          })),
        },
      },
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: ' Action ',
      rawTags: ['Action', 'Drama'],
    })).resolves.toEqual({
      ok: true,
      data: {
        pendingVideos: [expect.objectContaining({ id: 'pending-1' })],
        videos: [expect.objectContaining({ id: 'video-1' })],
      },
    });
  });

  test('returns an explicit failure when catalog or ingest pending-upload snapshot data is unavailable', async () => {
    const { createHomeLibraryPageServices } = await import('../../../app/composition/server/home-library-page');
    const loadPendingUploadSnapshot = vi
      .fn()
      .mockRejectedValueOnce(new Error('pending unavailable'));
    const catalogExecute = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        reason: 'CATALOG_SOURCE_UNAVAILABLE' as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        data: {
          filters: {
            displayQuery: '',
            normalizedQuery: '',
            normalizedTags: [],
            rawTags: [],
          },
          videos: [createFixtureVideo()],
        },
      });
    const services = createHomeLibraryPageServices({
      ingestServices: {
        loadPendingUploadSnapshot: {
          execute: loadPendingUploadSnapshot,
        },
      },
      libraryServices: {
        loadLibraryCatalogSnapshot: {
          execute: catalogExecute,
        },
      },
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: '',
      rawTags: [],
    })).resolves.toEqual({
      ok: false,
      reason: 'HOME_DATA_UNAVAILABLE',
    });
    expect(loadPendingUploadSnapshot).not.toHaveBeenCalled();

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: '',
      rawTags: [],
    })).resolves.toEqual({
      ok: false,
      reason: 'HOME_DATA_UNAVAILABLE',
    });
    expect(catalogExecute).toHaveBeenCalledTimes(2);
    expect(loadPendingUploadSnapshot).toHaveBeenCalledOnce();
  });

  test('builds default pending-upload services without requiring VIDEO_MASTER_ENCRYPTION_SEED for the home path', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-home-pending-regression-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    previousVideoMasterEncryptionSeed = process.env.VIDEO_MASTER_ENCRYPTION_SEED;
    process.env.STORAGE_DIR = storageDir;
    delete process.env.VIDEO_MASTER_ENCRYPTION_SEED;
    await mkdir(join(storageDir, 'data'), { recursive: true });
    await writeFile(join(storageDir, 'data', 'videos.json'), '[]', 'utf8');
    await writeFile(
      join(storageDir, 'data', 'pending.json'),
      JSON.stringify([
        {
          createdAt: '2026-03-29T00:00:00.000Z',
          filename: 'pending.mp4',
          id: 'pending-1',
          size: 128,
          type: 'video/mp4',
        },
      ], null, 2),
      'utf8',
    );
    vi.resetModules();

    const { createHomeLibraryPageServices } = await import('../../../app/composition/server/home-library-page');
    const services = createHomeLibraryPageServices({
      libraryServices: {
        loadLibraryCatalogSnapshot: {
          execute: vi.fn(async () => ({
            ok: true as const,
            data: {
              filters: {
                displayQuery: '',
                normalizedQuery: '',
                normalizedTags: [],
                rawTags: [],
              },
              videos: [createFixtureVideo()],
            },
          })),
        },
      },
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: '',
      rawTags: [],
    })).resolves.toEqual({
      ok: true,
      data: {
        pendingVideos: [
          {
            filename: 'pending.mp4',
            id: 'pending-1',
            size: 128,
            type: 'video/mp4',
          },
        ],
        videos: [expect.objectContaining({ id: 'video-1' })],
      },
    });
  });
});
