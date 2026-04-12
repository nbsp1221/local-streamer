import { beforeEach, describe, expect, test, vi } from 'vitest';

const createCanonicalVideoMetadataLegacyStoreMock = vi.fn();
const FfmpegIngestPendingThumbnailEnricherAdapterMock = vi.fn();
const JsonIngestPendingVideoReaderAdapterMock = vi.fn();
const FilesystemIngestPreparedVideoWorkspaceAdapterMock = vi.fn();
const FilesystemIngestUploadScanAdapterMock = vi.fn();
const FfmpegIngestVideoProcessingAdapterMock = vi.fn();

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

vi.mock('~/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter', () => ({
  FfmpegIngestVideoProcessingAdapter: FfmpegIngestVideoProcessingAdapterMock,
}));

vi.mock('~/modules/ingest/infrastructure/pending/json-ingest-pending-video-reader.adapter', () => ({
  JsonIngestPendingVideoReaderAdapter: JsonIngestPendingVideoReaderAdapterMock,
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

    expect(FilesystemIngestPreparedVideoWorkspaceAdapterMock).not.toHaveBeenCalled();
    expect(FfmpegIngestVideoProcessingAdapterMock).not.toHaveBeenCalled();
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
