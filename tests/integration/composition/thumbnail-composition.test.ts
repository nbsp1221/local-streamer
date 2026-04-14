import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const ORIGINAL_STORAGE_DIR = process.env.STORAGE_DIR;

const mockDecryptThumbnail = vi.fn();

function createDecryptedThumbnailRequest(
  request: Request,
  overrides: Partial<{
    videoId: string;
  }> = {},
) {
  return {
    contentSource: 'encrypted-thumbnail',
    eTagPrefix: 'encrypted',
    notFoundMessage: 'Encrypted thumbnail not found',
    request,
    videoId: overrides.videoId ?? 'video-1',
  };
}

function createSuccessfulDecryptResult() {
  return {
    data: {
      imageBuffer: Buffer.from([1, 2, 3, 4]),
      mimeType: 'image/jpeg',
      size: 4,
      videoId: 'video-1',
    },
    success: true as const,
  };
}

async function importThumbnailComposition() {
  vi.doMock('~/modules/thumbnail/infrastructure/decryption/thumbnail-decryption.service', () => ({
    ThumbnailDecryptionService: class {
      decryptThumbnail = mockDecryptThumbnail;
    },
  }));

  return import('../../../app/composition/server/thumbnails');
}

async function importRealThumbnailComposition() {
  vi.resetModules();
  vi.doUnmock('~/modules/thumbnail/infrastructure/decryption/thumbnail-decryption.service');

  return import('../../../app/composition/server/thumbnails');
}

async function createThumbnailStorageRoot() {
  const rootDir = await mkdtemp(path.join(tmpdir(), 'thumbnail-composition-'));
  const storageDir = path.join(rootDir, 'storage');
  await mkdir(path.join(storageDir, 'uploads', 'thumbnails'), { recursive: true });
  return { rootDir, storageDir };
}

afterEach(() => {
  mockDecryptThumbnail.mockReset();
  vi.resetModules();
  vi.doUnmock('~/modules/thumbnail/infrastructure/decryption/thumbnail-decryption.service');

  if (ORIGINAL_STORAGE_DIR === undefined) {
    delete process.env.STORAGE_DIR;
    return;
  }

  process.env.STORAGE_DIR = ORIGINAL_STORAGE_DIR;
});

describe('thumbnail composition ownership', () => {
  test('thumbnail composition does not import app/legacy directly', async () => {
    const source = await readFile(path.resolve(PROJECT_ROOT, 'app/composition/server/thumbnails.ts'), 'utf8');

    expect(source.includes('~/legacy/'), 'thumbnail composition').toBe(false);
    expect(source.includes('app/legacy/'), 'thumbnail composition').toBe(false);
  });

  test('thumbnail storage paths resolve from STORAGE_DIR when provided', async () => {
    process.env.STORAGE_DIR = '/tmp/thumbnail-storage-root';
    const { getThumbnailStoragePaths } = await import('../../../app/modules/thumbnail/infrastructure/storage/thumbnail-storage-paths.server');

    expect(getThumbnailStoragePaths()).toEqual({
      storageDir: path.resolve('/tmp/thumbnail-storage-root'),
      thumbnailsDir: path.resolve('/tmp/thumbnail-storage-root', 'uploads', 'thumbnails'),
      uploadsDir: path.resolve('/tmp/thumbnail-storage-root', 'uploads'),
      videosDir: path.resolve('/tmp/thumbnail-storage-root', 'data', 'videos'),
    });
  });

  test('thumbnail storage paths fall back to the repo storage directory when STORAGE_DIR is absent', async () => {
    delete process.env.STORAGE_DIR;
    const { getThumbnailStoragePaths } = await import('../../../app/modules/thumbnail/infrastructure/storage/thumbnail-storage-paths.server');

    expect(getThumbnailStoragePaths()).toEqual({
      storageDir: path.resolve(process.cwd(), 'storage'),
      thumbnailsDir: path.resolve(process.cwd(), 'storage', 'uploads', 'thumbnails'),
      uploadsDir: path.resolve(process.cwd(), 'storage', 'uploads'),
      videosDir: path.resolve(process.cwd(), 'storage', 'data', 'videos'),
    });
  });

  test('loadThumbnailPreviewResponse serves preview thumbnails from the active storage path', async () => {
    const { rootDir, storageDir } = await createThumbnailStorageRoot();
    process.env.STORAGE_DIR = storageDir;

    try {
      const previewPath = path.join(storageDir, 'uploads', 'thumbnails', 'preview.jpg');
      await writeFile(previewPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

      const { loadThumbnailPreviewResponse } = await importThumbnailComposition();
      const response = await loadThumbnailPreviewResponse({
        filename: 'preview.jpg',
      });

      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600, must-revalidate');
      expect(response.headers.get('Content-Type')).toBe('image/jpeg');
      expect(response.headers.get('ETag')).toMatch(/^"preview-preview\.jpg-/);
      expect((await response.arrayBuffer()).byteLength).toBe(4);
    }
    finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('loadThumbnailPreviewResponse returns 404 when the preview file is missing', async () => {
    const { rootDir, storageDir } = await createThumbnailStorageRoot();
    process.env.STORAGE_DIR = storageDir;

    try {
      const { loadThumbnailPreviewResponse } = await importThumbnailComposition();

      await expect(loadThumbnailPreviewResponse({
        filename: 'missing.jpg',
      })).rejects.toMatchObject({
        status: 404,
      });
    }
    finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('loadDecryptedThumbnailResponse returns 404 when the thumbnail service reports not found', async () => {
    mockDecryptThumbnail.mockResolvedValue({
      error: new Error('Encrypted thumbnail not found for video'),
      success: false,
    });

    const { loadDecryptedThumbnailResponse } = await importThumbnailComposition();
    const response = await loadDecryptedThumbnailResponse(
      createDecryptedThumbnailRequest(new Request('http://localhost/api/thumbnail-encrypted/video-1')),
    );

    expect(response.status).toBe(404);
    await expect(response.text()).resolves.toBe('Encrypted thumbnail not found');
  });

  test('loadDecryptedThumbnailResponse returns 500 when the thumbnail service reports an unexpected error', async () => {
    mockDecryptThumbnail.mockResolvedValue({
      error: new Error('boom'),
      success: false,
    });

    const { loadDecryptedThumbnailResponse } = await importThumbnailComposition();
    const response = await loadDecryptedThumbnailResponse(
      createDecryptedThumbnailRequest(new Request('http://localhost/api/thumbnail-encrypted/video-1')),
    );

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe('Failed to decrypt thumbnail');
  });

  test('loadDecryptedThumbnailResponse returns 500 for invalid thumbnail ids', async () => {
    const { loadDecryptedThumbnailResponse } = await importRealThumbnailComposition();
    const response = await loadDecryptedThumbnailResponse(
      createDecryptedThumbnailRequest(
        new Request('http://localhost/api/thumbnail-encrypted/not-a-uuid'),
        { videoId: 'not-a-uuid' },
      ),
    );

    expect(response.status).toBe(500);
    await expect(response.text()).resolves.toBe('Failed to decrypt thumbnail');
  });

  test('loadDecryptedThumbnailResponse returns 304 when If-None-Match matches the generated ETag', async () => {
    mockDecryptThumbnail.mockResolvedValue(createSuccessfulDecryptResult());

    const { loadDecryptedThumbnailResponse } = await importThumbnailComposition();
    const response = await loadDecryptedThumbnailResponse(createDecryptedThumbnailRequest(
      new Request('http://localhost/api/thumbnail-encrypted/video-1', {
        headers: {
          'If-None-Match': '"encrypted-video-1-4"',
        },
      }),
    ));

    expect(response.status).toBe(304);
  });

  test('loadDecryptedThumbnailResponse preserves X-Content-Source and payload headers on success', async () => {
    mockDecryptThumbnail.mockResolvedValue(createSuccessfulDecryptResult());

    const { loadDecryptedThumbnailResponse } = await importThumbnailComposition();
    const response = await loadDecryptedThumbnailResponse(
      createDecryptedThumbnailRequest(new Request('http://localhost/api/thumbnail-encrypted/video-1')),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Content-Length')).toBe('4');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=3600');
    expect(response.headers.get('ETag')).toBe('"encrypted-video-1-4"');
    expect(response.headers.get('X-Content-Source')).toBe('encrypted-thumbnail');
    expect((await response.arrayBuffer()).byteLength).toBe(4);
  });
});
