import { describe, expect, test } from 'vitest';
import { Pbkdf2KeyManagerAdapter } from '~/modules/video/security/adapters/pbkdf2-key-manager.adapter';

describe('Pbkdf2KeyManagerAdapter Tests', () => {
  const testVideoIds = [
    'test-video-123',
    'sample-uuid-4567',
    'another-video-id-890',
    'short-id',
    'very-long-video-identifier-with-special-characters-123456789',
  ];

  test('should generate different keys for different video IDs', () => {
    const keyManager = new Pbkdf2KeyManagerAdapter();

    const keys = testVideoIds.map(videoId => (keyManager as any).generateVideoKey(videoId));

    // Each key should be unique
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        expect(keys[i].equals(keys[j])).toBe(false);
      }
    }
  });

  test('should be deterministic - same input produces same output', () => {
    const keyManager = new Pbkdf2KeyManagerAdapter();
    const testId = 'deterministic-test';

    const key1 = (keyManager as any).generateVideoKey(testId);
    const key2 = (keyManager as any).generateVideoKey(testId);
    const key3 = (keyManager as any).generateVideoKey(testId);

    expect(key1.equals(key2)).toBe(true);
    expect(key2.equals(key3)).toBe(true);
    expect(key1.equals(key3)).toBe(true);
  });

  test('should handle edge cases correctly', () => {
    const keyManager = new Pbkdf2KeyManagerAdapter();

    const edgeCases = [
      '', // Empty string
      '1', // Single character
      'a'.repeat(100), // Very long string
      '特殊字符测试', // Unicode characters
      '123-456-789_abc.def', // Special characters
    ];

    for (const testCase of edgeCases) {
      const key = (keyManager as any).generateVideoKey(testCase);

      expect(key.length).toBe(16); // AES-128 key size

      // Keys should not be all zeros or all same byte
      const uniqueBytes = new Set(key);
      expect(uniqueBytes.size).toBeGreaterThan(1);
    }
  });

  test('should maintain cryptographic properties', () => {
    const keyManager = new Pbkdf2KeyManagerAdapter();
    const keys = [];

    // Generate many keys to test distribution
    for (let i = 0; i < 100; i++) {
      const key = (keyManager as any).generateVideoKey(`test-video-${i}`);
      keys.push(key);

      // Each key should be 16 bytes
      expect(key.length).toBe(16);

      // Keys should not be all zeros or all same byte
      const uniqueBytes = new Set(key);
      expect(uniqueBytes.size).toBeGreaterThan(1);
    }

    // All keys should be unique
    const keyHexes = keys.map(k => k.toString('hex'));
    const uniqueHexes = new Set(keyHexes);
    expect(uniqueHexes.size).toBe(100);
  });
});
