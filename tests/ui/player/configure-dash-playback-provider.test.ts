import { describe, expect, test, vi } from 'vitest';

describe('configureDashPlaybackProvider', () => {
  test('injects the playback token into DASH requests that do not already have one', async () => {
    const { configureDashPlaybackProvider } = await import('../../../app/widgets/player-surface/lib/configure-dash-playback-provider');

    const interceptorCallbacks: Array<(request: { url: string }) => Promise<{ url: string }>> = [];
    const provider = {
      addRequestInterceptor: (callback: (request: { url: string }) => Promise<{ url: string }>) => {
        interceptorCallbacks.push(callback);
      },
      getProtectionController: () => undefined,
      off: vi.fn(),
      on: vi.fn(),
      setProtectionData: vi.fn(),
    };

    await configureDashPlaybackProvider({
      drmConfig: null,
      loadDashLibrary: async () => ({
        MediaPlayer: {
          events: {
            STREAM_INITIALIZED: 'streamInitialized',
          },
        },
      }),
      provider,
      token: 'playback-token',
    });

    const interceptor = interceptorCallbacks[0];

    expect(interceptor).toBeDefined();
    await expect(interceptor({ url: 'https://example.com/video/init.mp4' })).resolves.toMatchObject({
      url: 'https://example.com/video/init.mp4?token=playback-token',
    });
    await expect(interceptor({ url: 'https://example.com/video/init.mp4?token=existing' })).resolves.toMatchObject({
      url: 'https://example.com/video/init.mp4?token=existing',
    });
  });

  test('attaches ClearKey protection immediately when the controller already exists', async () => {
    const { configureDashPlaybackProvider } = await import('../../../app/widgets/player-surface/lib/configure-dash-playback-provider');
    const setProtectionData = vi.fn();

    await configureDashPlaybackProvider({
      drmConfig: {
        key: 'clear-key',
        keyId: 'clear-key-id',
      },
      loadDashLibrary: async () => ({
        MediaPlayer: {
          events: {
            STREAM_INITIALIZED: 'streamInitialized',
          },
        },
      }),
      provider: {
        addRequestInterceptor: vi.fn(),
        getProtectionController: () => ({}),
        off: vi.fn(),
        on: vi.fn(),
        setProtectionData,
      },
      token: null,
    });

    expect(setProtectionData).toHaveBeenCalledWith({
      'org.w3.clearkey': {
        clearkeys: {
          'clear-key-id': 'clear-key',
        },
      },
    });
  });
});
