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

describe('getPlaybackStoragePaths', () => {
  test('resolves playback videos directory from STORAGE_DIR when provided', async () => {
    process.env.STORAGE_DIR = '/tmp/playback-storage-root';
    const { getPlaybackStoragePaths } = await import('../../../app/modules/playback/infrastructure/storage/playback-storage-paths.server');

    expect(getPlaybackStoragePaths()).toEqual({
      storageDir: path.resolve('/tmp/playback-storage-root'),
      videosDir: path.resolve('/tmp/playback-storage-root', 'data', 'videos'),
    });
  });

  test('falls back to the repo storage directory when STORAGE_DIR is absent', async () => {
    delete process.env.STORAGE_DIR;
    const { getPlaybackStoragePaths } = await import('../../../app/modules/playback/infrastructure/storage/playback-storage-paths.server');

    expect(getPlaybackStoragePaths()).toEqual({
      storageDir: path.resolve(process.cwd(), 'storage'),
      videosDir: path.resolve(process.cwd(), 'storage', 'data', 'videos'),
    });
  });
});
