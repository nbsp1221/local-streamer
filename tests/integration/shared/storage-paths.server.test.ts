import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

const ORIGINAL_STORAGE_DIR = process.env.STORAGE_DIR;
const ORIGINAL_VIDEO_METADATA_SQLITE_PATH = process.env.VIDEO_METADATA_SQLITE_PATH;

afterEach(() => {
  vi.resetModules();

  if (ORIGINAL_STORAGE_DIR === undefined) {
    delete process.env.STORAGE_DIR;
    return;
  }

  process.env.STORAGE_DIR = ORIGINAL_STORAGE_DIR;

  if (ORIGINAL_VIDEO_METADATA_SQLITE_PATH === undefined) {
    delete process.env.VIDEO_METADATA_SQLITE_PATH;
    return;
  }

  process.env.VIDEO_METADATA_SQLITE_PATH = ORIGINAL_VIDEO_METADATA_SQLITE_PATH;
});

describe('shared storage paths', () => {
  test('resolves staging and canonical metadata paths from STORAGE_DIR', async () => {
    process.env.STORAGE_DIR = '/tmp/shared-storage-root';
    const { getStoragePaths } = await import('../../../app/shared/config/storage-paths.server');
    const { getVideoMetadataConfig } = await import('../../../app/shared/config/video-metadata.server');

    expect(getStoragePaths()).toEqual({
      stagingDir: path.resolve('/tmp/shared-storage-root', 'data', 'staging'),
      stagingTempDir: path.resolve('/tmp/shared-storage-root', 'data', 'staging', 'temp'),
      storageDir: path.resolve('/tmp/shared-storage-root'),
      videosDir: path.resolve('/tmp/shared-storage-root', 'data', 'videos'),
    });
    expect(getVideoMetadataConfig()).toEqual({
      sqlitePath: path.resolve('/tmp/shared-storage-root', 'data', 'video-metadata.sqlite'),
    });
  });

  test('falls back to the repository storage directory when STORAGE_DIR is absent', async () => {
    delete process.env.STORAGE_DIR;
    const { getStoragePaths } = await import('../../../app/shared/config/storage-paths.server');
    const { getVideoMetadataConfig } = await import('../../../app/shared/config/video-metadata.server');

    expect(getStoragePaths()).toEqual({
      stagingDir: path.resolve(process.cwd(), 'storage', 'data', 'staging'),
      stagingTempDir: path.resolve(process.cwd(), 'storage', 'data', 'staging', 'temp'),
      storageDir: path.resolve(process.cwd(), 'storage'),
      videosDir: path.resolve(process.cwd(), 'storage', 'data', 'videos'),
    });
    expect(getVideoMetadataConfig()).toEqual({
      sqlitePath: path.resolve(process.cwd(), 'storage', 'data', 'video-metadata.sqlite'),
    });
  });

  test('respects an explicit VIDEO_METADATA_SQLITE_PATH override while keeping staging on STORAGE_DIR', async () => {
    process.env.STORAGE_DIR = '/tmp/shared-storage-root';
    process.env.VIDEO_METADATA_SQLITE_PATH = '/tmp/custom/video-metadata.sqlite';
    const { getStoragePaths } = await import('../../../app/shared/config/storage-paths.server');
    const { getVideoMetadataConfig } = await import('../../../app/shared/config/video-metadata.server');

    expect(getStoragePaths()).toEqual({
      stagingDir: path.resolve('/tmp/shared-storage-root', 'data', 'staging'),
      stagingTempDir: path.resolve('/tmp/shared-storage-root', 'data', 'staging', 'temp'),
      storageDir: path.resolve('/tmp/shared-storage-root'),
      videosDir: path.resolve('/tmp/shared-storage-root', 'data', 'videos'),
    });
    expect(getVideoMetadataConfig()).toEqual({
      sqlitePath: path.resolve('/tmp/custom/video-metadata.sqlite'),
    });
  });
});
