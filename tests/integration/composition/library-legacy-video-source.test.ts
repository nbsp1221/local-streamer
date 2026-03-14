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

describe('library legacy video source', () => {
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

  test('maps the legacy repository shape into canonical library videos and hydrates createdAt as Date', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-library-source-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await seedStorage(storageDir, {
      videos: [
        {
          createdAt: '2026-03-10T00:00:00.000Z',
          description: 'Fixture description',
          duration: 95,
          id: 'video-1',
          tags: ['Action', 'Drama'],
          thumbnailUrl: '/uploads/thumbnails/video-1.jpg',
          title: 'Fixture Video',
          videoUrl: '/videos/video-1/manifest.mpd',
        },
      ],
    });
    vi.resetModules();

    const { createLibraryLegacyVideoSource } = await import('../../../app/composition/server/library-legacy-video-source');
    const source = createLibraryLegacyVideoSource();

    await expect(source.listLibraryVideos()).resolves.toEqual([
      {
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        description: 'Fixture description',
        duration: 95,
        id: 'video-1',
        tags: ['Action', 'Drama'],
        thumbnailUrl: '/uploads/thumbnails/video-1.jpg',
        title: 'Fixture Video',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    ]);
  });
});
