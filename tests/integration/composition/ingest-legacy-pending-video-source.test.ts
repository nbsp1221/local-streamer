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

describe('ingest legacy pending video source', () => {
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

  test('returns canonical ingest pending uploads from the legacy pending repository while preserving MIME-style types', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-pending-source-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await seedStorage(storageDir, {
      pendingVideos: [
        {
          createdAt: '2026-03-28T00:00:00.000Z',
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

    const { createIngestLegacyPendingVideoSource } = await import('../../../app/composition/server/ingest-legacy-pending-video-source');
    const source = createIngestLegacyPendingVideoSource();

    await expect(source.readPendingUploads()).resolves.toEqual([
      {
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        filename: 'fixture-upload.mp4',
        id: 'pending-1',
        size: 128,
        thumbnailUrl: '/uploads/thumbnails/pending-1.jpg',
        type: 'video/mp4',
      },
    ]);
  });

  test('normalizes extension-style types into MIME-style values when pending data is scan-shaped', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-pending-source-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await seedStorage(storageDir, {
      pendingVideos: [
        {
          createdAt: '2026-03-28T00:00:00.000Z',
          filename: 'fixture-upload.mp4',
          id: 'pending-1',
          size: 128,
          type: 'mp4',
        },
      ],
    });
    vi.resetModules();

    const { createIngestLegacyPendingVideoSource } = await import('../../../app/composition/server/ingest-legacy-pending-video-source');
    const source = createIngestLegacyPendingVideoSource();

    await expect(source.readPendingUploads()).resolves.toEqual([
      expect.objectContaining({
        id: 'pending-1',
        type: 'video/mp4',
      }),
    ]);
  });
});
