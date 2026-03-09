import { describe, expect, test } from 'vitest';
import { createSmokeServerEnv } from '../../smoke/support/create-smoke-server-env';

describe('createSmokeServerEnv', () => {
  test('builds a deterministic smoke server env without ambient local playback secrets', () => {
    const originalPath = process.env.PATH;
    const originalVideoJwtSecret = process.env.VIDEO_JWT_SECRET;
    const originalVideoSeed = process.env.VIDEO_MASTER_ENCRYPTION_SEED;
    const originalCustomValue = process.env.LOCAL_STREAMER_SMOKE_NOISE;

    process.env.PATH = '/tmp/test-bin';
    process.env.VIDEO_JWT_SECRET = 'ambient-secret-that-must-not-leak';
    process.env.VIDEO_MASTER_ENCRYPTION_SEED = 'ambient-seed-that-must-not-leak';
    process.env.LOCAL_STREAMER_SMOKE_NOISE = 'ambient-noise';

    try {
      const env = createSmokeServerEnv({
        AUTH_SHARED_PASSWORD: 'vault-password',
        AUTH_SQLITE_PATH: '/tmp/auth.sqlite',
        PORT: '3999',
        STORAGE_DIR: '/tmp/storage',
      });

      expect(env.PATH).toBe('/tmp/test-bin');
      expect(env.AUTH_SHARED_PASSWORD).toBe('vault-password');
      expect(env.AUTH_SQLITE_PATH).toBe('/tmp/auth.sqlite');
      expect(env.PORT).toBe('3999');
      expect(env.STORAGE_DIR).toBe('/tmp/storage');
      expect(env.VIDEO_JWT_SECRET).toBe('smoke-video-jwt-secret');
      expect(env.VIDEO_MASTER_ENCRYPTION_SEED).toBe(
        '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      );
      expect(env.LOCAL_STREAMER_SMOKE_NOISE).toBeUndefined();
    }
    finally {
      if (originalPath === undefined) {
        delete process.env.PATH;
      }
      else {
        process.env.PATH = originalPath;
      }

      if (originalVideoJwtSecret === undefined) {
        delete process.env.VIDEO_JWT_SECRET;
      }
      else {
        process.env.VIDEO_JWT_SECRET = originalVideoJwtSecret;
      }

      if (originalVideoSeed === undefined) {
        delete process.env.VIDEO_MASTER_ENCRYPTION_SEED;
      }
      else {
        process.env.VIDEO_MASTER_ENCRYPTION_SEED = originalVideoSeed;
      }

      if (originalCustomValue === undefined) {
        delete process.env.LOCAL_STREAMER_SMOKE_NOISE;
      }
      else {
        process.env.LOCAL_STREAMER_SMOKE_NOISE = originalCustomValue;
      }
    }
  });
});
