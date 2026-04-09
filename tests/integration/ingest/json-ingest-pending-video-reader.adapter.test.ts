import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

describe('JsonIngestPendingVideoReaderAdapter', () => {
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
      tempDir = '';
    }
  });

  test('reads canonical pending uploads from pending.json while preserving MIME-style types', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-pending-reader-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await mkdir(join(storageDir, 'data'), { recursive: true });
    await writeFile(join(storageDir, 'data', 'pending.json'), JSON.stringify([
      {
        createdAt: '2026-03-28T00:00:00.000Z',
        filename: 'fixture-upload.mp4',
        id: 'pending-1',
        size: 128,
        thumbnailUrl: '/api/thumbnail-preview/pending-1.jpg',
        type: 'video/mp4',
      },
    ], null, 2));

    const { JsonIngestPendingVideoReaderAdapter } = await import('../../../app/modules/ingest/infrastructure/pending/json-ingest-pending-video-reader.adapter');
    const reader = new JsonIngestPendingVideoReaderAdapter();

    await expect(reader.readPendingUploads()).resolves.toEqual([
      {
        createdAt: new Date('2026-03-28T00:00:00.000Z'),
        filename: 'fixture-upload.mp4',
        id: 'pending-1',
        size: 128,
        thumbnailUrl: '/api/thumbnail-preview/pending-1.jpg',
        type: 'video/mp4',
      },
    ]);
  });

  test('returns an empty collection when pending.json does not exist yet', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-pending-reader-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;

    const { JsonIngestPendingVideoReaderAdapter } = await import('../../../app/modules/ingest/infrastructure/pending/json-ingest-pending-video-reader.adapter');
    const reader = new JsonIngestPendingVideoReaderAdapter();

    await expect(reader.readPendingUploads()).resolves.toEqual([]);
  });

  test('normalizes extension-style types into MIME-style values', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-pending-reader-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await mkdir(join(storageDir, 'data'), { recursive: true });
    await writeFile(join(storageDir, 'data', 'pending.json'), JSON.stringify([
      {
        createdAt: '2026-03-28T00:00:00.000Z',
        filename: 'fixture-upload.mp4',
        id: 'pending-1',
        size: 128,
        type: 'mp4',
      },
    ], null, 2));

    const { JsonIngestPendingVideoReaderAdapter } = await import('../../../app/modules/ingest/infrastructure/pending/json-ingest-pending-video-reader.adapter');
    const reader = new JsonIngestPendingVideoReaderAdapter();

    await expect(reader.readPendingUploads()).resolves.toEqual([
      expect.objectContaining({
        id: 'pending-1',
        type: 'video/mp4',
      }),
    ]);
  });

  test('throws when pending.json is malformed instead of returning an empty collection', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-pending-reader-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await mkdir(join(storageDir, 'data'), { recursive: true });
    await writeFile(join(storageDir, 'data', 'pending.json'), '{ invalid json', 'utf8');

    const { JsonIngestPendingVideoReaderAdapter } = await import('../../../app/modules/ingest/infrastructure/pending/json-ingest-pending-video-reader.adapter');
    const reader = new JsonIngestPendingVideoReaderAdapter();

    await expect(reader.readPendingUploads()).rejects.toThrow();
  });
});
