import { describe, expect, test } from 'vitest';
import { derivePlaybackEncryptionKey } from './derive-playback-encryption-key';

describe('derivePlaybackEncryptionKey', () => {
  test('derives a stable 16-byte playback key', () => {
    const env = {
      VIDEO_MASTER_ENCRYPTION_SEED: 'fixture-seed',
    };

    const key = derivePlaybackEncryptionKey({
      env,
      videoId: 'video-123',
    });

    expect(key).toBeInstanceOf(Buffer);
    expect(key).toHaveLength(16);
    expect(key.equals(derivePlaybackEncryptionKey({
      env,
      videoId: 'video-123',
    }))).toBe(true);
  });

  test('uses the test fallback seed under test envs', () => {
    const key = derivePlaybackEncryptionKey({
      env: {
        NODE_ENV: 'test',
      },
      videoId: 'video-123',
    });

    expect(key).toHaveLength(16);
  });

  test('fails when the runtime seed is missing outside tests', () => {
    expect(() => derivePlaybackEncryptionKey({
      env: {},
      videoId: 'video-123',
    })).toThrow('VIDEO_MASTER_ENCRYPTION_SEED environment variable is required for video encryption');
  });
});
