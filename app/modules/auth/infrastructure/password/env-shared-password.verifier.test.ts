import { afterEach, describe, expect, test, vi } from 'vitest';

describe('EnvSharedPasswordVerifier', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unmock('node:crypto');
  });

  test('uses fixed-size comparison even when password lengths differ', async () => {
    const timingSafeEqual = vi.fn(() => false);
    const createHash = vi.fn(() => ({
      digest: vi.fn(() => Buffer.alloc(32, 7)),
      update: vi.fn().mockReturnThis(),
    }));

    vi.doMock('node:crypto', () => ({
      createHash,
      timingSafeEqual,
    }));

    const { EnvSharedPasswordVerifier } = await import('./env-shared-password.verifier');
    const verifier = new EnvSharedPasswordVerifier({
      sharedPassword: 'correct-password',
    });

    await expect(verifier.verify('x')).resolves.toBe(false);
    expect(createHash).toHaveBeenCalledTimes(2);
    expect(timingSafeEqual).toHaveBeenCalledOnce();
    expect(timingSafeEqual.mock.calls[0]).toBeDefined();

    const [actualDigest, expectedDigest] = timingSafeEqual.mock.calls[0] as unknown as [Buffer, Buffer];

    expect(actualDigest).toBeInstanceOf(Buffer);
    expect(expectedDigest).toBeInstanceOf(Buffer);
    expect(actualDigest.length).toBe(32);
    expect(expectedDigest.length).toBe(32);
  });
});
