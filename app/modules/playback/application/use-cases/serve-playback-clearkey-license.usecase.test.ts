import { describe, expect, test, vi } from 'vitest';

describe('ServePlaybackClearKeyLicenseUseCase', () => {
  test('validates the playback token and returns the downstream license body and headers untouched', async () => {
    const { ServePlaybackClearKeyLicenseUseCase } = await import('./serve-playback-clearkey-license.usecase');
    const serveLicense = vi.fn(async () => ({
      body: JSON.stringify({
        keys: [{ k: 'key', kid: 'kid' }],
        type: 'temporary',
      }),
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
    }));
    const useCase = new ServePlaybackClearKeyLicenseUseCase({
      clearKeyService: {
        serveLicense,
      },
      tokenService: {
        issue: async () => '',
        validate: async () => ({ videoId: 'video-1' }),
      },
    });

    const result = await useCase.execute({
      token: 'signed-token',
      videoId: 'video-1',
    });

    expect(result).toEqual({
      body: JSON.stringify({
        keys: [{ k: 'key', kid: 'kid' }],
        type: 'temporary',
      }),
      headers: {
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
      },
      ok: true,
    });
    expect(serveLicense).toHaveBeenCalledWith({
      videoId: 'video-1',
    });
  });

  test('maps scope failures to explicit application results before route-level HTTP translation', async () => {
    const { ServePlaybackClearKeyLicenseUseCase } = await import('./serve-playback-clearkey-license.usecase');
    const useCase = new ServePlaybackClearKeyLicenseUseCase({
      clearKeyService: {
        serveLicense: async () => ({
          body: '{}',
          headers: {},
        }),
      },
      tokenService: {
        issue: async () => '',
        validate: async () => null,
      },
    });

    const result = await useCase.execute({
      token: null,
      videoId: 'video-1',
    });

    expect(result).toEqual({
      metadata: {
        requestedVideoId: 'video-1',
        resource: 'clearkey-license',
      },
      ok: false,
      reason: 'PLAYBACK_TOKEN_REQUIRED',
    });
  });
});
