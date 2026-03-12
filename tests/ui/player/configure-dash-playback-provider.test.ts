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

  test('attaches ClearKey protection immediately even when the protection controller is not ready yet', async () => {
    const { configureDashPlaybackProvider } = await import('../../../app/widgets/player-surface/lib/configure-dash-playback-provider');
    const setProtectionData = vi.fn();
    const provider = {
      addRequestInterceptor: vi.fn(),
      getProtectionController: () => undefined,
      off: vi.fn(),
      on: vi.fn(),
      setProtectionData,
    };

    await configureDashPlaybackProvider({
      drmConfig: {
        key: 'clear-key',
        keyId: 'clear-key-id',
      },
      provider,
      token: null,
    });

    expect(setProtectionData).toHaveBeenCalledTimes(1);
    expect(setProtectionData).toHaveBeenCalledWith({
      'org.w3.clearkey': {
        clearkeys: {
          'clear-key-id': 'clear-key',
        },
      },
    });
    expect(provider.on).not.toHaveBeenCalled();
    expect(provider.off).not.toHaveBeenCalled();
  });
});
