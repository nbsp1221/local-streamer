import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

async function seedStorage(storageDir: string, overrides?: { pendingVideos?: unknown[] }) {
  await mkdir(join(storageDir, 'data'), { recursive: true });
  await writeFile(join(storageDir, 'data', 'videos.json'), '[]', 'utf8');
  await writeFile(
    join(storageDir, 'data', 'pending.json'),
    JSON.stringify(overrides?.pendingVideos ?? [], null, 2),
    'utf8',
  );
}

describe('pending videos compat reader', () => {
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

  test('returns pending videos in the current compatibility shape without making them part of the library module contract', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-pending-reader-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await seedStorage(storageDir, {
      pendingVideos: [
        {
          filename: 'fixture-upload.mp4',
          id: 'pending-1',
          path: '/vault/uploads/fixture-upload.mp4',
          size: 128,
          thumbnailUrl: '/uploads/thumbnails/pending-1.jpg',
          type: 'video/mp4',
        },
      ],
    });
    vi.resetModules();

    const { createPendingVideosCompatReader } = await import('../../../app/composition/server/pending-videos-compat-reader');
    const reader = createPendingVideosCompatReader();

    await expect(reader.readPendingVideos()).resolves.toEqual([
      {
        filename: 'fixture-upload.mp4',
        id: 'pending-1',
        path: '/vault/uploads/fixture-upload.mp4',
        size: 128,
        thumbnailUrl: '/uploads/thumbnails/pending-1.jpg',
        type: 'video/mp4',
      },
    ]);
  });
});
