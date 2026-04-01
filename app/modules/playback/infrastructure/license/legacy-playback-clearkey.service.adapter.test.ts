import { describe, expect, test, vi } from 'vitest';

describe('PlaybackClearKeyService', () => {
  test('preserves downstream headers and serializes the legacy ClearKey response body unchanged', async () => {
    const { PlaybackClearKeyService } = await import('./playback-clearkey.service');
    const execute = vi.fn(async () => ({
      data: {
        clearKeyResponse: {
          keys: [
            {
              k: 'key',
              kid: 'kid',
              kty: 'oct',
            },
          ],
          type: 'temporary',
        },
        headers: {
          'Cache-Control': 'no-cache',
          'Content-Type': 'application/json',
        },
        success: true as const,
      },
      success: true,
    }));
    const adapter = new PlaybackClearKeyService({
      execute,
    });

    const result = await adapter.serveLicense({
      videoId: 'video-1',
    });

    expect(result).toEqual({
      body: JSON.stringify({
        keys: [
          {
            k: 'key',
            kid: 'kid',
            kty: 'oct',
          },
        ],
        type: 'temporary',
      }),
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    });
    expect(execute).toHaveBeenCalledOnce();
  });
});
