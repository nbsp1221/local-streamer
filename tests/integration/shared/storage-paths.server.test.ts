import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

const ORIGINAL_STORAGE_DIR = process.env.STORAGE_DIR;

afterEach(() => {
  vi.resetModules();

  if (ORIGINAL_STORAGE_DIR === undefined) {
    delete process.env.STORAGE_DIR;
    return;
  }

  process.env.STORAGE_DIR = ORIGINAL_STORAGE_DIR;
});

describe('shared storage paths', () => {
  test('resolves storage-relative uploads and thumbnails from STORAGE_DIR', async () => {
    process.env.STORAGE_DIR = '/tmp/shared-storage-root';
    const { getStoragePaths } = await import('../../../app/shared/config/storage-paths.server');

    expect(getStoragePaths()).toEqual({
      pendingJsonPath: path.resolve('/tmp/shared-storage-root', 'data', 'pending.json'),
      storageDir: path.resolve('/tmp/shared-storage-root'),
      thumbnailsDir: path.resolve('/tmp/shared-storage-root', 'uploads', 'thumbnails'),
      uploadsDir: path.resolve('/tmp/shared-storage-root', 'uploads'),
      videosDir: path.resolve('/tmp/shared-storage-root', 'data', 'videos'),
    });
  });

  test('falls back to the repository storage directory when STORAGE_DIR is absent', async () => {
    delete process.env.STORAGE_DIR;
    const { getStoragePaths } = await import('../../../app/shared/config/storage-paths.server');

    expect(getStoragePaths()).toEqual({
      pendingJsonPath: path.resolve(process.cwd(), 'storage', 'data', 'pending.json'),
      storageDir: path.resolve(process.cwd(), 'storage'),
      thumbnailsDir: path.resolve(process.cwd(), 'storage', 'uploads', 'thumbnails'),
      uploadsDir: path.resolve(process.cwd(), 'storage', 'uploads'),
      videosDir: path.resolve(process.cwd(), 'storage', 'data', 'videos'),
    });
  });
});
