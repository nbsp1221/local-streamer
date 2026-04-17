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
    await expect(interceptor({ url: '/videos/video-1/init.mp4' })).resolves.toMatchObject({
      url: '/videos/video-1/init.mp4?token=playback-token',
    });
  });

  test('falls back to the dash.js v4 RequestModifier extension when request interceptors are unavailable', async () => {
    const { configureDashPlaybackProvider } = await import('../../../app/widgets/player-surface/lib/configure-dash-playback-provider');
    const extend = vi.fn();

    await configureDashPlaybackProvider({
      drmConfig: null,
      provider: {
        extend,
      },
      token: 'playback-token',
    });

    expect(extend).toHaveBeenCalledWith('RequestModifier', expect.any(Function), true);

    const requestModifierFactory = extend.mock.calls[0]?.[1] as (() => {
      modifyRequest: (request: { url: string }) => { url: string };
      modifyRequestURL: (url: string) => string;
    }) | undefined;

    expect(requestModifierFactory).toBeTypeOf('function');

    if (requestModifierFactory === undefined) {
      throw new Error('expected RequestModifier factory');
    }

    const requestModifier = requestModifierFactory();

    expect(requestModifier.modifyRequest({ url: 'https://example.com/video/init.mp4' })).toMatchObject({
      url: 'https://example.com/video/init.mp4?token=playback-token',
    });
    expect(requestModifier.modifyRequest({ url: 'https://example.com/video/init.mp4?token=existing' })).toMatchObject({
      url: 'https://example.com/video/init.mp4?token=existing',
    });
    expect(requestModifier.modifyRequestURL('https://example.com/video/init.mp4')).toBe(
      'https://example.com/video/init.mp4?token=playback-token',
    );
    expect(requestModifier.modifyRequestURL('https://example.com/video/init.mp4?token=existing')).toBe(
      'https://example.com/video/init.mp4?token=existing',
    );
    expect(requestModifier.modifyRequestURL('/videos/video-1/init.mp4')).toBe(
      '/videos/video-1/init.mp4?token=playback-token',
    );
  });

  test('materializes the protection controller before attaching ClearKey protection', async () => {
    const { configureDashPlaybackProvider } = await import('../../../app/widgets/player-surface/lib/configure-dash-playback-provider');
    const getProtectionController = vi.fn(() => ({}));
    const setProtectionData = vi.fn();

    await configureDashPlaybackProvider({
      drmConfig: {
        key: 'clear-key',
        keyId: 'clear-key-id',
      },
      provider: {
        addRequestInterceptor: vi.fn(),
        getProtectionController,
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
    expect(getProtectionController).toHaveBeenCalledTimes(1);
  });

  test('waits for stream initialization before retrying ClearKey protection when the first attach attempt fails', async () => {
    const { configureDashPlaybackProvider } = await import('../../../app/widgets/player-surface/lib/configure-dash-playback-provider');
    const setProtectionData = vi.fn()
      .mockImplementationOnce(() => {
        throw new TypeError('dash is not ready yet');
      });
    let streamInitializedListener: (() => void) | undefined;
    const on = vi.fn((event: string, listener: () => void) => {
      if (event === 'streamInitialized') {
        streamInitializedListener = listener;
      }
    });
    const off = vi.fn();
    const provider = {
      addRequestInterceptor: vi.fn(),
      off,
      on,
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
    expect(on).toHaveBeenCalledWith('streamInitialized', expect.any(Function));
    expect(streamInitializedListener).toBeTypeOf('function');

    if (streamInitializedListener === undefined) {
      throw new Error('expected streamInitialized listener');
    }

    const listener = streamInitializedListener;
    listener();

    expect(off).toHaveBeenCalledWith('streamInitialized', listener);
    expect(setProtectionData).toHaveBeenCalledTimes(2);
    expect(setProtectionData).toHaveBeenCalledWith({
      'org.w3.clearkey': {
        clearkeys: {
          'clear-key-id': 'clear-key',
        },
      },
    });
  });

  test('still attempts the immediate DRM attach when probing the protection controller throws', async () => {
    const { configureDashPlaybackProvider } = await import('../../../app/widgets/player-surface/lib/configure-dash-playback-provider');
    const setProtectionData = vi.fn();

    await configureDashPlaybackProvider({
      drmConfig: {
        key: 'clear-key',
        keyId: 'clear-key-id',
      },
      provider: {
        addRequestInterceptor: vi.fn(),
        getProtectionController: () => {
          throw new TypeError('dash protection controller is not ready');
        },
        off: vi.fn(),
        on: vi.fn(),
        setProtectionData,
      },
      token: null,
    });

    expect(setProtectionData).toHaveBeenCalledTimes(1);
  });
});
