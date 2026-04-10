import { beforeEach, describe, expect, test, vi } from 'vitest';

const createCanonicalVideoMetadataLegacyStoreMock = vi.fn();
const FfmpegIngestPendingThumbnailEnricherAdapterMock = vi.fn();
const JsonIngestPendingVideoReaderAdapterMock = vi.fn();
const FilesystemIngestUploadScanAdapterMock = vi.fn();
const FilesystemIngestPreparedVideoWorkspaceAdapterMock = vi.fn();
const createIngestLegacyVideoProcessingMock = vi.fn();

vi.mock('~/composition/server/canonical-video-metadata-legacy-store', () => ({
  createCanonicalVideoMetadataLegacyStore: createCanonicalVideoMetadataLegacyStoreMock,
}));

vi.mock('~/modules/ingest/infrastructure/thumbnail/ffmpeg-ingest-pending-thumbnail-enricher.adapter', () => ({
  FfmpegIngestPendingThumbnailEnricherAdapter: FfmpegIngestPendingThumbnailEnricherAdapterMock,
}));

vi.mock('~/modules/ingest/infrastructure/workspace/filesystem-ingest-prepared-video-workspace.adapter', () => ({
  FilesystemIngestPreparedVideoWorkspaceAdapter: FilesystemIngestPreparedVideoWorkspaceAdapterMock,
}));

vi.mock('~/modules/ingest/infrastructure/scan/filesystem-ingest-upload-scan.adapter', () => ({
  FilesystemIngestUploadScanAdapter: FilesystemIngestUploadScanAdapterMock,
}));

vi.mock('~/composition/server/ingest-legacy-video-processing', () => ({
  createIngestLegacyVideoProcessing: createIngestLegacyVideoProcessingMock,
}));

vi.mock('~/modules/ingest/infrastructure/pending/json-ingest-pending-video-reader.adapter', () => ({
  JsonIngestPendingVideoReaderAdapter: JsonIngestPendingVideoReaderAdapterMock,
}));

describe('server ingest composition root', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('creates prewired ingest services from injected adapters', async () => {
    const { createServerIngestServices } = await import('../../../app/composition/server/ingest');
    const discoverUploads = vi.fn(async () => [
      {
        createdAt: new Date('2026-03-17T00:00:00.000Z'),
        filename: 'fixture-video.mp4',
        id: 'fixture-video',
        size: 1_024,
        type: 'mp4',
      },
    ]);
    const enrichPendingUploads = vi.fn(async (files: Array<{
      createdAt: Date;
      filename: string;
      id: string;
      size: number;
      type: string;
    }>) => files.map(file => ({
      ...file,
      thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
    })));
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
      pendingThumbnailEnricher: {
        enrichPendingUploads,
      },
      uploadScan: {
        discoverUploads,
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

    expect(discoverUploads).toHaveBeenCalledOnce();
    expect(enrichPendingUploads).toHaveBeenCalledOnce();
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
    FilesystemIngestUploadScanAdapterMock.mockImplementation(() => ({
      discoverUploads: scanIncomingVideos,
    }));
    FfmpegIngestPendingThumbnailEnricherAdapterMock.mockImplementation(() => ({
      enrichPendingUploads: vi.fn(async () => []),
    }));
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
    FilesystemIngestPreparedVideoWorkspaceAdapterMock.mockImplementation(() => ({
      preparePreparedVideo: prepareVideoForLibrary,
      recoverPreparedVideo: recoverFailedPreparedVideo,
    }));
    createIngestLegacyVideoProcessingMock.mockReturnValue({
      finalizeSuccessfulVideo: finalizeSuccessfulPreparedVideo,
      processPreparedVideo,
    });
    const readPendingUploads = vi.fn(async () => []);
    JsonIngestPendingVideoReaderAdapterMock.mockImplementation(() => ({
      readPendingUploads,
    }));
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
    expect(FilesystemIngestUploadScanAdapterMock).toHaveBeenCalledOnce();
    expect(FfmpegIngestPendingThumbnailEnricherAdapterMock).toHaveBeenCalledOnce();
    expect(FilesystemIngestPreparedVideoWorkspaceAdapterMock).toHaveBeenCalledOnce();
    expect(createIngestLegacyVideoProcessingMock).toHaveBeenCalledOnce();
    expect(JsonIngestPendingVideoReaderAdapterMock).toHaveBeenCalledOnce();
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
