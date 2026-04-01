import { beforeEach, describe, expect, test, vi } from 'vitest';

const requireProtectedMediaSessionMock = vi.fn();
const requireProtectedPageSessionMock = vi.fn();
const fakePlaybackServices = {
  issuePlaybackToken: {
    execute: vi.fn(),
  },
  resolvePlayerVideo: {
    execute: vi.fn(),
  },
  servePlaybackClearKeyLicense: {
    execute: vi.fn(),
  },
  servePlaybackManifest: {
    execute: vi.fn(),
  },
  servePlaybackMediaSegment: {
    execute: vi.fn(),
  },
};

vi.mock('~/composition/server/auth', () => ({
  requireProtectedMediaSession: requireProtectedMediaSessionMock,
  requireProtectedPageSession: requireProtectedPageSessionMock,
}));

vi.mock('~/composition/server/playback', () => ({
  getServerPlaybackServices: () => fakePlaybackServices,
}));

async function importVideoTokenRoute() {
  return import('../../../app/routes/videos.$videoId.token');
}

async function importManifestRoute() {
  return import('../../../app/routes/videos.$videoId.manifest[.]mpd');
}

async function importVideoSegmentRoute() {
  return import('../../../app/routes/videos.$videoId.video.$filename');
}

async function importAudioSegmentRoute() {
  return import('../../../app/routes/videos.$videoId.audio.$filename');
}

async function importClearKeyRoute() {
  return import('../../../app/routes/videos.$videoId.clearkey');
}

describe('Phase 2 playback route adapters', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    fakePlaybackServices.issuePlaybackToken.execute.mockReset();
    fakePlaybackServices.resolvePlayerVideo.execute.mockReset();
    fakePlaybackServices.servePlaybackClearKeyLicense.execute.mockReset();
    fakePlaybackServices.servePlaybackManifest.execute.mockReset();
    fakePlaybackServices.servePlaybackMediaSegment.execute.mockReset();
    requireProtectedMediaSessionMock.mockResolvedValue(null);
    requireProtectedPageSessionMock.mockResolvedValue({ id: 'session-1' });
  });

  test('token route delegates issuance to the playback composition root and preserves the current success contract', async () => {
    fakePlaybackServices.issuePlaybackToken.execute.mockResolvedValue({
      success: true,
      token: 'signed-token',
      urls: {
        clearkey: '/videos/video-1/clearkey?token=signed-token',
        manifest: '/videos/video-1/manifest.mpd?token=signed-token',
      },
    });
    const { loader } = await importVideoTokenRoute();

    const response = await loader({
      params: { videoId: 'video-1' },
      request: new Request('http://localhost/videos/video-1/token', {
        headers: {
          'User-Agent': 'vitest',
          'X-Real-IP': '203.0.113.10',
        },
      }),
    } as never);

    expect(fakePlaybackServices.issuePlaybackToken.execute).toHaveBeenCalledWith({
      hasSiteSession: true,
      ipAddress: '203.0.113.10',
      userAgent: 'vitest',
      videoId: 'video-1',
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      token: 'signed-token',
      urls: {
        clearkey: '/videos/video-1/clearkey?token=signed-token',
        manifest: '/videos/video-1/manifest.mpd?token=signed-token',
      },
    });
  });

  test('manifest, segment, audio segment, and clearkey routes delegate to playback services for valid tokens', async () => {
    fakePlaybackServices.servePlaybackManifest.execute.mockResolvedValue({
      body: '<MPD />',
      headers: { 'Content-Type': 'application/dash+xml' },
      ok: true,
    });
    fakePlaybackServices.servePlaybackMediaSegment.execute
      .mockResolvedValueOnce({
        headers: { 'Content-Length': '64' },
        isRangeResponse: false,
        ok: true,
        stream: new ReadableStream<Uint8Array>(),
      })
      .mockResolvedValueOnce({
        headers: { 'Content-Length': '32' },
        isRangeResponse: true,
        ok: true,
        statusCode: 206,
        stream: new ReadableStream<Uint8Array>(),
      });
    fakePlaybackServices.servePlaybackClearKeyLicense.execute.mockResolvedValue({
      body: '{"keys":[]}',
      headers: { 'Content-Type': 'application/json' },
      ok: true,
    });

    const [{ loader: manifestLoader }, { loader: videoLoader }, { loader: audioLoader }, { loader: clearKeyLoader }] = await Promise.all([
      importManifestRoute(),
      importVideoSegmentRoute(),
      importAudioSegmentRoute(),
      importClearKeyRoute(),
    ]);

    const manifestResponse = await manifestLoader({
      params: { videoId: 'video-1' },
      request: new Request('http://localhost/videos/video-1/manifest.mpd?token=signed-token'),
    } as never);
    const videoResponse = await videoLoader({
      params: { filename: 'init.mp4', videoId: 'video-1' },
      request: new Request('http://localhost/videos/video-1/video/init.mp4?token=signed-token'),
    } as never);
    const audioResponse = await audioLoader({
      params: { filename: 'segment-0001.m4s', videoId: 'video-1' },
      request: new Request('http://localhost/videos/video-1/audio/segment-0001.m4s?token=signed-token', {
        headers: {
          range: 'bytes=0-31',
        },
      }),
    } as never);
    const clearKeyResponse = await clearKeyLoader({
      params: { videoId: 'video-1' },
      request: new Request('http://localhost/videos/video-1/clearkey?token=signed-token'),
    } as never);

    expect(fakePlaybackServices.servePlaybackManifest.execute).toHaveBeenCalledWith({
      token: 'signed-token',
      videoId: 'video-1',
    });
    expect(fakePlaybackServices.servePlaybackMediaSegment.execute).toHaveBeenNthCalledWith(1, {
      filename: 'init.mp4',
      mediaType: 'video',
      rangeHeader: null,
      token: 'signed-token',
      videoId: 'video-1',
    });
    expect(fakePlaybackServices.servePlaybackMediaSegment.execute).toHaveBeenNthCalledWith(2, {
      filename: 'segment-0001.m4s',
      mediaType: 'audio',
      rangeHeader: 'bytes=0-31',
      token: 'signed-token',
      videoId: 'video-1',
    });
    expect(fakePlaybackServices.servePlaybackClearKeyLicense.execute).toHaveBeenCalledWith({
      token: 'signed-token',
      videoId: 'video-1',
    });
    expect(manifestResponse.status).toBe(200);
    expect(videoResponse.status).toBe(200);
    expect(audioResponse.status).toBe(206);
    expect(clearKeyResponse.status).toBe(200);
  });

  test('clearkey action delegates POST license requests to the playback composition root', async () => {
    fakePlaybackServices.servePlaybackClearKeyLicense.execute.mockResolvedValue({
      body: '{"keys":[]}',
      headers: { 'Content-Type': 'application/json' },
      ok: true,
    });
    const { action } = await importClearKeyRoute();

    const response = await action({
      params: { videoId: 'video-1' },
      request: new Request('http://localhost/videos/video-1/clearkey?token=signed-token', {
        method: 'POST',
      }),
    } as never);

    expect(fakePlaybackServices.servePlaybackClearKeyLicense.execute).toHaveBeenCalledWith({
      token: 'signed-token',
      videoId: 'video-1',
    });
    expect(response.status).toBe(200);
  });

  test('manifest route accepts Authorization bearer token when the query token is absent', async () => {
    fakePlaybackServices.servePlaybackManifest.execute.mockResolvedValue({
      body: '<MPD />',
      headers: { 'Content-Type': 'application/dash+xml' },
      ok: true,
    });
    const { loader } = await importManifestRoute();

    const response = await loader({
      params: { videoId: 'video-1' },
      request: new Request('http://localhost/videos/video-1/manifest.mpd', {
        headers: {
          Authorization: 'Bearer header-token',
        },
      }),
    } as never);

    expect(fakePlaybackServices.servePlaybackManifest.execute).toHaveBeenCalledWith({
      token: 'header-token',
      videoId: 'video-1',
    });
    expect(response.status).toBe(200);
  });

  test.each([
    {
      expectedBody: 'Playback token required',
      invoke: () => importManifestRoute().then(({ loader }) => loader({
        params: { videoId: 'video-1' },
        request: new Request('http://localhost/videos/video-1/manifest.mpd'),
      } as never)),
      result: {
        metadata: {
          requestedVideoId: 'video-1',
          resource: 'manifest',
        },
        ok: false,
        reason: 'PLAYBACK_TOKEN_REQUIRED',
      },
      target: 'manifest',
    },
    {
      expectedBody: 'Playback token video scope mismatch',
      invoke: () => importVideoSegmentRoute().then(({ loader }) => loader({
        params: { filename: 'init.mp4', videoId: 'video-1' },
        request: new Request('http://localhost/videos/video-1/video/init.mp4?token=signed-token'),
      } as never)),
      result: {
        metadata: {
          requestedVideoId: 'video-1',
          resource: 'segment',
          tokenVideoId: 'video-2',
        },
        ok: false,
        reason: 'VIDEO_SCOPE_MISMATCH',
      },
      target: 'segment',
    },
    {
      expectedBody: 'Playback token required',
      invoke: () => importClearKeyRoute().then(({ loader }) => loader({
        params: { videoId: 'video-1' },
        request: new Request('http://localhost/videos/video-1/clearkey'),
      } as never)),
      result: {
        metadata: {
          requestedVideoId: 'video-1',
          resource: 'clearkey-license',
        },
        ok: false,
        reason: 'PLAYBACK_TOKEN_REQUIRED',
      },
      target: 'clearkey-license',
    },
  ])('returns 401 when the playback service denies the $target request', async ({ expectedBody, invoke, result, target }) => {
    if (target === 'manifest') {
      fakePlaybackServices.servePlaybackManifest.execute.mockResolvedValue(result);
    }
    else if (target === 'segment') {
      fakePlaybackServices.servePlaybackMediaSegment.execute.mockResolvedValue(result);
    }
    else {
      fakePlaybackServices.servePlaybackClearKeyLicense.execute.mockResolvedValue(result);
    }

    const response = await invoke();

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe(expectedBody);
  });
});
