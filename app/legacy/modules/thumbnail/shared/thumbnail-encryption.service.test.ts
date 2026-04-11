import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

const ORIGINAL_STORAGE_DIR = process.env.STORAGE_DIR;
const TEST_KEY = Buffer.from('0123456789abcdef');
const VALID_JPEG_FIXTURE_PATH = path.resolve(process.cwd(), 'public/images/video-placeholder.jpg');

function createKeyManager() {
  return {
    cleanupTempFiles: async () => {},
    generateAndStoreKey: async () => ({
      key: TEST_KEY,
      keyInfoFile: '/tmp/keyinfo.txt',
    }),
    keyExists: async () => true,
    retrieveKey: async () => TEST_KEY,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();

  if (ORIGINAL_STORAGE_DIR === undefined) {
    delete process.env.STORAGE_DIR;
    return;
  }

  process.env.STORAGE_DIR = ORIGINAL_STORAGE_DIR;
});

describe('ThumbnailEncryptionService', () => {
  test('decrypts a valid encrypted JPEG thumbnail', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'thumbnail-encryption-service-'));
    const storageDir = path.join(rootDir, 'storage');
    const videoId = '68e5f819-15e8-41ef-90ee-8a96769311b7';
    process.env.STORAGE_DIR = storageDir;

    try {
      const { ThumbnailCryptoUtils } = await import('./thumbnail-crypto.utils');
      const validJpegBuffer = await readFile(VALID_JPEG_FIXTURE_PATH);
      await mkdir(path.join(storageDir, 'data', 'videos', videoId), { recursive: true });
      const encryptedThumbnail = ThumbnailCryptoUtils.encryptWithIVHeader(validJpegBuffer, TEST_KEY);
      expect(encryptedThumbnail.success).toBe(true);

      await writeFile(
        path.join(storageDir, 'data', 'videos', videoId, 'thumbnail.jpg'),
        encryptedThumbnail.data!,
      );

      const { ThumbnailEncryptionService } = await import('./thumbnail-encryption.service');
      const service = new ThumbnailEncryptionService({
        keyManager: createKeyManager(),
        logger: console,
      });

      await expect(service.decryptThumbnail({ videoId })).resolves.toEqual({
        imageBuffer: validJpegBuffer,
        mimeType: 'image/jpeg',
        size: validJpegBuffer.length,
      });
    }
    finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('rejects decrypted payloads that are not valid JPEGs even when AES-CBC reports success', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'thumbnail-encryption-service-'));
    const storageDir = path.join(rootDir, 'storage');
    const videoId = '68e5f819-15e8-41ef-90ee-8a96769311b7';
    process.env.STORAGE_DIR = storageDir;

    try {
      const { ThumbnailCryptoUtils } = await import('./thumbnail-crypto.utils');
      const validJpegBuffer = await readFile(VALID_JPEG_FIXTURE_PATH);
      await mkdir(path.join(storageDir, 'data', 'videos', videoId), { recursive: true });
      const encryptedThumbnail = ThumbnailCryptoUtils.encryptWithIVHeader(validJpegBuffer, TEST_KEY);
      expect(encryptedThumbnail.success).toBe(true);

      await writeFile(
        path.join(storageDir, 'data', 'videos', videoId, 'thumbnail.jpg'),
        encryptedThumbnail.data!,
      );

      vi.spyOn(ThumbnailCryptoUtils, 'decryptWithIVHeader').mockReturnValue({
        data: Buffer.from('not-a-jpeg'),
        success: true,
      });

      const { ThumbnailEncryptionService } = await import('./thumbnail-encryption.service');
      const service = new ThumbnailEncryptionService({
        keyManager: createKeyManager(),
        logger: console,
      });

      await expect(service.decryptThumbnail({ videoId })).rejects.toThrow(
        'Failed to decrypt thumbnail: Decrypted thumbnail is not a valid JPEG image',
      );
    }
    finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });
});
