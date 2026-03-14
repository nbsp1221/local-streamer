import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

async function seedStorage(storageDir: string, overrides?: { videos?: unknown[] }) {
  await mkdir(join(storageDir, 'data'), { recursive: true });
  await writeFile(
    join(storageDir, 'data', 'videos.json'),
    JSON.stringify(overrides?.videos ?? [], null, 2),
    'utf8',
  );
  await writeFile(join(storageDir, 'data', 'pending.json'), '[]', 'utf8');
}

describe('server library composition root', () => {
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

    if (tempDir) {
      await rm(tempDir, { force: true, recursive: true });
    }
  });

  test('creates prewired library catalog services from injected adapters', async () => {
    const { createServerLibraryServices } = await import('../../../app/composition/server/library');
    const listLibraryVideos = vi.fn(async () => [
      {
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
        duration: 180,
        id: 'video-1',
        tags: ['Action'],
        title: 'Catalog Fixture',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    ]);

    const services = createServerLibraryServices({
      videoSource: {
        listLibraryVideos,
      },
    });
    const result = await services.loadLibraryCatalogSnapshot.execute({
      rawQuery: 'Action',
      rawTags: ['Action'],
    });

    expect(listLibraryVideos).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      data: {
        videos: [
          expect.objectContaining({
            id: 'video-1',
            title: 'Catalog Fixture',
          }),
        ],
        filters: {
          displayQuery: 'Action',
          normalizedQuery: 'action',
          rawTags: ['Action'],
          normalizedTags: ['action'],
        },
      },
    });
  });

  test('returns a cached default library composition that stays ready for route usage', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-library-composition-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await seedStorage(storageDir, {
      videos: [
        {
          createdAt: '2026-03-11T00:00:00.000Z',
          duration: 180,
          id: 'video-1',
          tags: ['Action'],
          title: 'Catalog Fixture',
          videoUrl: '/videos/video-1/manifest.mpd',
        },
      ],
    });
    vi.resetModules();

    const { getServerLibraryServices } = await import('../../../app/composition/server/library');
    const first = getServerLibraryServices();
    const second = getServerLibraryServices();

    expect(first).toBe(second);
    await expect(first.loadLibraryCatalogSnapshot.execute({
      rawQuery: '',
      rawTags: [],
    })).resolves.toEqual({
      ok: true,
      data: {
        videos: [
          expect.objectContaining({
            id: 'video-1',
          }),
        ],
        filters: {
          displayQuery: '',
          normalizedQuery: '',
          rawTags: [],
          normalizedTags: [],
        },
      },
    });
  });
});
