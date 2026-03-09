import { describe, expect, test } from 'vitest';

describe('PlaybackGrantPolicy', () => {
  test('allows playback token issuance when a site session is active', async () => {
    const { PlaybackGrantPolicy } = await import('./PlaybackGrantPolicy');

    const decision = PlaybackGrantPolicy.evaluate({
      hasSiteSession: true,
    });

    expect(decision).toEqual({
      allowed: true,
    });
  });

  test('denies playback token issuance without a site session using an explicit reason', async () => {
    const { PlaybackGrantPolicy } = await import('./PlaybackGrantPolicy');

    const decision = PlaybackGrantPolicy.evaluate({
      hasSiteSession: false,
    });

    expect(decision).toEqual({
      allowed: false,
      reason: 'SITE_SESSION_REQUIRED',
    });
  });
});
