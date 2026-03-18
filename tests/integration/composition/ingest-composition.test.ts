import { beforeEach, describe, expect, test, vi } from 'vitest';

const createIngestLegacyIncomingVideoSourceMock = vi.fn();

vi.mock('~/composition/server/ingest-legacy-incoming-video-source', () => ({
  createIngestLegacyIncomingVideoSource: createIngestLegacyIncomingVideoSourceMock,
}));

describe('server ingest composition root', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('creates prewired ingest services from injected adapters', async () => {
    const { createServerIngestServices } = await import('../../../app/composition/server/ingest');
    const scanIncomingVideos = vi.fn(async () => [
      {
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        filename: 'fixture-video.mp4',
        id: 'fixture-video',
        size: 1_024,
        thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
        type: 'mp4',
      },
    ]);

    const services = createServerIngestServices({
      incomingVideoSource: {
        scanIncomingVideos,
      },
    });
    const result = await services.scanIncomingVideos.execute();

    expect(scanIncomingVideos).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      data: {
        count: 1,
        files: [
          expect.objectContaining({
            filename: 'fixture-video.mp4',
            id: 'fixture-video',
          }),
        ],
      },
    });
  });

  test('returns a cached default ingest composition and keeps legacy wiring outside the module boundary', async () => {
    const scanIncomingVideos = vi.fn(async () => []);
    createIngestLegacyIncomingVideoSourceMock.mockReturnValue({
      scanIncomingVideos,
    });

    const { getServerIngestServices } = await import('../../../app/composition/server/ingest');
    const first = getServerIngestServices();
    const second = getServerIngestServices();

    expect(first).toBe(second);
    expect(createIngestLegacyIncomingVideoSourceMock).toHaveBeenCalledOnce();
    await expect(first.scanIncomingVideos.execute()).resolves.toEqual({
      ok: true,
      data: {
        count: 0,
        files: [],
      },
    });
  });
});
