import { beforeEach, describe, expect, test, vi } from 'vitest';

const requireProtectedApiSessionMock = vi.fn();
const fakeIngestServices = {
  scanIncomingVideos: {
    execute: vi.fn(),
  },
};

vi.mock('~/composition/server/auth', () => ({
  requireProtectedApiSession: requireProtectedApiSessionMock,
}));

vi.mock('~/composition/server/ingest', () => ({
  getServerIngestServices: () => fakeIngestServices,
}));

async function importScanIncomingRoute() {
  return import('../../../app/routes/api.scan-incoming');
}

describe('scan incoming api route', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    fakeIngestServices.scanIncomingVideos.execute.mockReset();
  });

  test('loads pending files through the ingest composition root and preserves the response contract', async () => {
    requireProtectedApiSessionMock.mockResolvedValue(null);
    fakeIngestServices.scanIncomingVideos.execute.mockResolvedValue({
      ok: true,
      data: {
        count: 1,
        files: [
          {
            createdAt: new Date('2026-03-17T00:00:00.000Z'),
            filename: 'fixture-video.mp4',
            id: 'fixture-video',
            size: 1_024,
            thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
            type: 'mp4',
          },
        ],
      },
    });
    const { loader } = await importScanIncomingRoute();

    const response = await loader({
      request: new Request('http://localhost/api/scan-incoming'),
    } as never);

    expect(fakeIngestServices.scanIncomingVideos.execute).toHaveBeenCalledOnce();
    expect(response).toBeInstanceOf(Response);
    await expect((response as Response).json()).resolves.toEqual({
      count: 1,
      files: [
        {
          createdAt: '2026-03-17T00:00:00.000Z',
          filename: 'fixture-video.mp4',
          id: 'fixture-video',
          size: 1_024,
          thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
          type: 'mp4',
        },
      ],
      success: true,
    });
  });

  test('returns the existing error contract when the ingest scan is unavailable', async () => {
    requireProtectedApiSessionMock.mockResolvedValue(null);
    fakeIngestServices.scanIncomingVideos.execute.mockResolvedValue({
      ok: false,
      reason: 'INCOMING_SCAN_UNAVAILABLE',
    });
    const { loader } = await importScanIncomingRoute();

    const response = await loader({
      request: new Request('http://localhost/api/scan-incoming'),
    } as never);

    expect((response as Response).status).toBe(500);
    await expect((response as Response).json()).resolves.toEqual({
      count: 0,
      error: 'Failed to scan uploads files',
      files: [],
      success: false,
    });
  });

  test('returns the auth gate response without touching ingest services when the request is unauthorized', async () => {
    const unauthorizedResponse = new Response('unauthorized', { status: 401 });
    requireProtectedApiSessionMock.mockResolvedValue(unauthorizedResponse);
    const { loader } = await importScanIncomingRoute();

    const response = await loader({
      request: new Request('http://localhost/api/scan-incoming'),
    } as never);

    expect(response).toBe(unauthorizedResponse);
    expect(fakeIngestServices.scanIncomingVideos.execute).not.toHaveBeenCalled();
  });
});
