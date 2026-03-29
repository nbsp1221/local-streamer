import { beforeEach, describe, expect, test, vi } from 'vitest';

const createCanonicalVideoMetadataLegacyStoreMock = vi.fn();
const createIngestLegacyIncomingVideoSourceMock = vi.fn();
const createIngestLegacyPendingVideoSourceMock = vi.fn();
const createIngestLegacyPreparedVideoWorkspaceMock = vi.fn();
const createIngestLegacyVideoProcessingMock = vi.fn();

vi.mock('~/composition/server/canonical-video-metadata-legacy-store', () => ({
  createCanonicalVideoMetadataLegacyStore: createCanonicalVideoMetadataLegacyStoreMock,
}));

vi.mock('~/composition/server/ingest-legacy-incoming-video-source', () => ({
  createIngestLegacyIncomingVideoSource: createIngestLegacyIncomingVideoSourceMock,
}));

vi.mock('~/composition/server/ingest-legacy-prepared-video-workspace', () => ({
  createIngestLegacyPreparedVideoWorkspace: createIngestLegacyPreparedVideoWorkspaceMock,
}));

vi.mock('~/composition/server/ingest-legacy-video-processing', () => ({
  createIngestLegacyVideoProcessing: createIngestLegacyVideoProcessingMock,
}));

vi.mock('~/composition/server/ingest-legacy-pending-video-source', () => ({
  createIngestLegacyPendingVideoSource: createIngestLegacyPendingVideoSourceMock,
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
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
    }));
    const finalizeSuccessfulPreparedVideo = vi.fn(async () => undefined);
    const recoverFailedPreparedVideo = vi.fn(async () => ({
      restoredThumbnail: true,
      retryAvailability: 'restored' as const,
    }));
    const readPendingUploads = vi.fn(async () => []);
    const writeVideoRecord = vi.fn(async () => undefined);

    const services = createServerIngestServices({
      incomingVideoSource: {
        scanIncomingVideos,
      },
      pendingVideoReader: {
        readPendingUploads,
      },
      preparedVideoWorkspace: {
        preparePreparedVideo: prepareVideoForLibrary,
        recoverPreparedVideo: recoverFailedPreparedVideo,
      },
      videoMetadataWriter: {
        writeVideoRecord,
      },
      videoProcessing: {
        finalizeSuccessfulVideo: finalizeSuccessfulPreparedVideo,
        processPreparedVideo,
      },
    });
    const result = await services.scanIncomingVideos.execute();
    const pendingSnapshot = await services.loadPendingUploadSnapshot.execute();
    const addResult = await services.addVideoToLibrary.execute({
      filename: 'fixture-video.mp4',
      tags: [],
      title: 'Fixture Video',
    });

    expect(scanIncomingVideos).toHaveBeenCalledOnce();
    expect(prepareVideoForLibrary).toHaveBeenCalledOnce();
    expect(processPreparedVideo).toHaveBeenCalledOnce();
    expect(recoverFailedPreparedVideo).not.toHaveBeenCalled();
    expect(readPendingUploads).toHaveBeenCalledOnce();
    expect(writeVideoRecord).toHaveBeenCalledOnce();
    expect(finalizeSuccessfulPreparedVideo).toHaveBeenCalledOnce();
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
    expect(pendingSnapshot).toEqual({
      ok: true,
      data: {
        count: 0,
        files: [],
      },
    });
    expect(addResult).toEqual({
      ok: true,
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        videoId: expect.any(String),
      },
    });
  });

  test('returns a cached default ingest composition and surfaces processing failures without persisting metadata', async () => {
    const scanIncomingVideos = vi.fn(async () => []);
    createIngestLegacyIncomingVideoSourceMock.mockReturnValue({
      scanIncomingVideos,
    });
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: false,
      message: 'Video conversion failed',
    }));
    const finalizeSuccessfulPreparedVideo = vi.fn(async () => undefined);
    const recoverFailedPreparedVideo = vi.fn(async () => ({
      restoredThumbnail: true,
      retryAvailability: 'restored' as const,
    }));
    createIngestLegacyPreparedVideoWorkspaceMock.mockReturnValue({
      preparePreparedVideo: prepareVideoForLibrary,
      recoverPreparedVideo: recoverFailedPreparedVideo,
    });
    createIngestLegacyVideoProcessingMock.mockReturnValue({
      finalizeSuccessfulVideo: finalizeSuccessfulPreparedVideo,
      processPreparedVideo,
    });
    const readPendingUploads = vi.fn(async () => []);
    createIngestLegacyPendingVideoSourceMock.mockReturnValue({
      readPendingUploads,
    });
    const writeVideoRecord = vi.fn(async () => undefined);
    createCanonicalVideoMetadataLegacyStoreMock.mockReturnValue({
      listLibraryVideos: vi.fn(),
      writeVideoRecord,
    });

    const { getServerIngestServices } = await import('../../../app/composition/server/ingest');
    const first = getServerIngestServices();
    const second = getServerIngestServices();

    expect(first).toBe(second);
    await expect(first.scanIncomingVideos.execute()).resolves.toEqual({
      ok: true,
      data: {
        count: 0,
        files: [],
      },
    });
    await expect(first.loadPendingUploadSnapshot.execute()).resolves.toEqual({
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
      ok: false,
      message: 'Video conversion failed. The upload was restored so you can retry.',
      reason: 'ADD_TO_LIBRARY_UNAVAILABLE',
    });
    expect(createIngestLegacyIncomingVideoSourceMock).toHaveBeenCalledOnce();
    expect(createIngestLegacyPreparedVideoWorkspaceMock).toHaveBeenCalledOnce();
    expect(createIngestLegacyVideoProcessingMock).toHaveBeenCalledOnce();
    expect(createIngestLegacyPendingVideoSourceMock).toHaveBeenCalledOnce();
    expect(createCanonicalVideoMetadataLegacyStoreMock).toHaveBeenCalledOnce();
    expect(readPendingUploads).toHaveBeenCalledOnce();
    expect(writeVideoRecord).not.toHaveBeenCalled();
    expect(recoverFailedPreparedVideo).toHaveBeenCalledWith({
      filename: 'fixture-video.mp4',
      videoId: expect.any(String),
    });
    expect(finalizeSuccessfulPreparedVideo).not.toHaveBeenCalled();
  });
});
