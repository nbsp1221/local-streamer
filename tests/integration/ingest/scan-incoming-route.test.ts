import { describe, expect, test, vi } from 'vitest';
import { createScanIncomingLoader } from '../../../app/routes/api.scan-incoming';

describe('scan incoming api route', () => {
  test('loads pending files through the ingest composition root and preserves the response contract', async () => {
    const requireProtectedApiSession = vi.fn(async () => null);
    const execute = vi.fn(async () => ({
      ok: true as const,
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
    }));
    const loader = createScanIncomingLoader({
      getServerIngestServices: () => ({
        addVideoToLibrary: {
          execute: vi.fn(),
        },
        scanIncomingVideos: {
          execute,
        },
      }),
      requireProtectedApiSession,
    });

    const response = await loader({
      request: new Request('http://localhost/api/scan-incoming'),
    } as never);

    expect(requireProtectedApiSession).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
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
    const execute = vi.fn(async () => ({
      ok: false as const,
      reason: 'INCOMING_SCAN_UNAVAILABLE' as const,
    }));
    const loader = createScanIncomingLoader({
      getServerIngestServices: () => ({
        addVideoToLibrary: {
          execute: vi.fn(),
        },
        scanIncomingVideos: {
          execute,
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

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
    const requireProtectedApiSession = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    const execute = vi.fn();
    const loader = createScanIncomingLoader({
      getServerIngestServices: () => ({
        addVideoToLibrary: {
          execute: vi.fn(),
        },
        scanIncomingVideos: {
          execute,
        },
      }),
      requireProtectedApiSession,
    });

    const response = await loader({
      request: new Request('http://localhost/api/scan-incoming'),
    } as never);

    expect((response as Response).status).toBe(401);
    await expect((response as Response).text()).resolves.toBe('unauthorized');
    expect(execute).not.toHaveBeenCalled();
  });
});
