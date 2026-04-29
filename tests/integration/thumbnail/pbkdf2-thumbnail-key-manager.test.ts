import crypto from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

describe('Pbkdf2ThumbnailKeyManager', () => {
  const originalStorageDir = process.env.STORAGE_DIR;
  let rootDir: string;
  let storageDir: string;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'thumbnail-key-manager-'));
    storageDir = join(rootDir, 'storage');
    process.env.STORAGE_DIR = storageDir;
  });

  afterEach(async () => {
    if (originalStorageDir === undefined) {
      delete process.env.STORAGE_DIR;
    }
    else {
      process.env.STORAGE_DIR = originalStorageDir;
    }

    await rm(rootDir, { force: true, recursive: true });
  });

  test('generateAndStoreKey writes key.bin and retrieveKey/keyExists expose the same 16-byte key', async () => {
    const { Pbkdf2ThumbnailKeyManager } = await import('../../../app/modules/thumbnail/infrastructure/security/pbkdf2-thumbnail-key-manager');
    const manager = new Pbkdf2ThumbnailKeyManager();

    const result = await manager.generateAndStoreKey('video-123');
    const storedKey = await manager.retrieveKey('video-123');

    expect(result.key).toHaveLength(16);
    expect(result.keyInfoFile).toBe(join(storageDir, 'videos', 'video-123', 'keyinfo.txt'));
    expect(storedKey).toEqual(result.key);
    await expect(readFile(join(storageDir, 'videos', 'video-123', 'key.bin'))).resolves.toEqual(result.key);
    await expect(manager.keyExists('video-123')).resolves.toBe(true);
  });

  test('test mode remains deterministic for repo tests', async () => {
    const { Pbkdf2ThumbnailKeyManager } = await import('../../../app/modules/thumbnail/infrastructure/security/pbkdf2-thumbnail-key-manager');
    const manager = new Pbkdf2ThumbnailKeyManager();

    const first = await manager.generateAndStoreKey('video-123');
    const second = await manager.generateAndStoreKey('video-123');

    expect(first.key).toEqual(second.key);
  });

  test('non-test mode reads VIDEO_MASTER_ENCRYPTION_SEED and KEY_SALT_PREFIX with 100000 rounds', async () => {
    const { Pbkdf2ThumbnailKeyManager } = await import('../../../app/modules/thumbnail/infrastructure/security/pbkdf2-thumbnail-key-manager');
    const manager = new Pbkdf2ThumbnailKeyManager({
      env: {
        KEY_SALT_PREFIX: 'vault-salt',
        VIDEO_MASTER_ENCRYPTION_SEED: 'vault-seed',
      },
      testMode: false,
    });

    const { key } = await manager.generateAndStoreKey('video-123');
    const expectedSalt = crypto.createHash('sha256')
      .update('vault-saltvideo-123')
      .digest();
    const expectedKey = crypto.pbkdf2Sync('vault-seed', expectedSalt, 100000, 16, 'sha256');

    expect(key).toEqual(expectedKey);
  });
});
