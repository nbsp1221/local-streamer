import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

async function writeIncomingFile(storageDir: string, relativePath: string, contents = 'video-fixture') {
  const targetPath = join(storageDir, 'uploads', relativePath);
  await mkdir(join(targetPath, '..'), { recursive: true });
  await writeFile(targetPath, contents, 'utf8');
}

function createLogger() {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  };
}

describe('FilesystemIngestUploadScanAdapter', () => {
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
      tempDir = '';
    }
  });

  test('discovers supported top-level upload files and keeps createdAt as Date', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-upload-scan-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await writeIncomingFile(storageDir, 'fixture-video.mp4');

    const { FilesystemIngestUploadScanAdapter } = await import('../../../app/modules/ingest/infrastructure/scan/filesystem-ingest-upload-scan.adapter');
    const source = new FilesystemIngestUploadScanAdapter({
      logger: createLogger(),
    });

    const files = await source.discoverUploads();

    expect(files).toEqual([
      expect.objectContaining({
        filename: 'fixture-video.mp4',
        id: 'fixture-video',
        size: expect.any(Number),
        type: 'mp4',
      }),
    ]);
    expect(files[0]?.createdAt).toBeInstanceOf(Date);
  });

  test('ignores unsupported files and nested directories under uploads', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-upload-scan-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;
    await writeIncomingFile(storageDir, 'allowed-video.mp4');
    await writeIncomingFile(storageDir, 'ignored.txt', 'not-a-video');
    await mkdir(join(storageDir, 'uploads', 'nested'), { recursive: true });
    await writeIncomingFile(storageDir, 'nested/child-video.mp4');

    const { FilesystemIngestUploadScanAdapter } = await import('../../../app/modules/ingest/infrastructure/scan/filesystem-ingest-upload-scan.adapter');
    const source = new FilesystemIngestUploadScanAdapter({
      logger: createLogger(),
    });

    const files = await source.discoverUploads();

    expect(files).toEqual([
      expect.objectContaining({
        filename: 'allowed-video.mp4',
        id: 'allowed-video',
      }),
    ]);
  });

  test('returns an empty successful collection when the uploads directory does not exist yet', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-ingest-upload-scan-'));
    const storageDir = join(tempDir, 'storage');
    previousStorageDir = process.env.STORAGE_DIR;
    process.env.STORAGE_DIR = storageDir;

    const { FilesystemIngestUploadScanAdapter } = await import('../../../app/modules/ingest/infrastructure/scan/filesystem-ingest-upload-scan.adapter');
    const source = new FilesystemIngestUploadScanAdapter({
      logger: createLogger(),
    });

    await expect(source.discoverUploads()).resolves.toEqual([]);
  });
});
