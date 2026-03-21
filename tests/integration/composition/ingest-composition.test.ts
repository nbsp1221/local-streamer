import { beforeEach, describe, expect, test, vi } from 'vitest';

const createIngestLegacyIncomingVideoSourceMock = vi.fn();
const createIngestLegacyLibraryIntakeMock = vi.fn();

vi.mock('~/composition/server/ingest-legacy-incoming-video-source', () => ({
  createIngestLegacyIncomingVideoSource: createIngestLegacyIncomingVideoSourceMock,
}));

vi.mock('~/composition/server/ingest-legacy-library-intake', () => ({
  createIngestLegacyLibraryIntake: createIngestLegacyLibraryIntakeMock,
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
    const addVideoToLibrary = vi.fn(async () => ({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
      videoId: 'video-123',
    }));

    const services = createServerIngestServices({
      libraryIntake: {
        addVideoToLibrary,
      },
      incomingVideoSource: {
        scanIncomingVideos,
      },
    });
    const result = await services.scanIncomingVideos.execute();
    const addResult = await services.addVideoToLibrary.execute({
      filename: 'fixture-video.mp4',
      tags: [],
      title: 'Fixture Video',
    });

    expect(scanIncomingVideos).toHaveBeenCalledOnce();
    expect(addVideoToLibrary).toHaveBeenCalledOnce();
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
    expect(addResult).toEqual({
      ok: true,
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        videoId: 'video-123',
      },
    });
  });

  test('returns a cached default ingest composition and keeps legacy wiring outside the module boundary', async () => {
    const scanIncomingVideos = vi.fn(async () => []);
    createIngestLegacyIncomingVideoSourceMock.mockReturnValue({
      scanIncomingVideos,
    });
    const addVideoToLibrary = vi.fn(async () => ({
      dashEnabled: false,
      message: 'Video added to library but video conversion failed',
      videoId: 'video-456',
    }));
    createIngestLegacyLibraryIntakeMock.mockReturnValue({
      addVideoToLibrary,
    });

    const { getServerIngestServices } = await import('../../../app/composition/server/ingest');
    const first = getServerIngestServices();
    const second = getServerIngestServices();

    expect(first).toBe(second);
    expect(createIngestLegacyIncomingVideoSourceMock).toHaveBeenCalledOnce();
    expect(createIngestLegacyLibraryIntakeMock).toHaveBeenCalledOnce();
    await expect(first.scanIncomingVideos.execute()).resolves.toEqual({
      ok: true,
      data: {
        count: 0,
        files: [],
      },
    });
    await expect(first.addVideoToLibrary.execute({
      filename: 'fixture-video.mp4',
      tags: [],
      title: 'Fixture Video',
    })).resolves.toEqual({
      ok: true,
      data: {
        dashEnabled: false,
        message: 'Video added to library but video conversion failed',
        videoId: 'video-456',
      },
    });
  });
});
