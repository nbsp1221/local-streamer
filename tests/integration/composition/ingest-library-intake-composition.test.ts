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

describe('ingest library-intake composition', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('creates add-to-library from narrow ingest overrides without constructing the broad legacy intake adapter', async () => {
    const { createServerIngestServices } = await import('../../../app/composition/server/ingest');
    const preparePreparedVideo = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
    }));
    const finalizeSuccessfulVideo = vi.fn(async () => undefined);
    const recoverPreparedVideo = vi.fn(async () => ({
      restoredThumbnail: true,
      retryAvailability: 'restored' as const,
    }));
    const writeVideoRecord = vi.fn(async () => undefined);

    const services = createServerIngestServices({
      preparedVideoWorkspace: {
        preparePreparedVideo,
        recoverPreparedVideo,
      },
      videoMetadataWriter: {
        writeVideoRecord,
      },
      videoProcessing: {
        finalizeSuccessfulVideo,
        processPreparedVideo,
      },
    } as never);
    const result = await services.addVideoToLibrary.execute({
      filename: 'fixture-video.mp4',
      tags: [],
      title: 'Fixture Video',
    });

    expect(createIngestLegacyPreparedVideoWorkspaceMock).not.toHaveBeenCalled();
    expect(createIngestLegacyVideoProcessingMock).not.toHaveBeenCalled();
    expect(preparePreparedVideo).toHaveBeenCalledOnce();
    expect(processPreparedVideo).toHaveBeenCalledOnce();
    expect(finalizeSuccessfulVideo).toHaveBeenCalledOnce();
    expect(writeVideoRecord).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        videoId: expect.any(String),
      },
    });
  });
});
