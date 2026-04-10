import { afterEach, describe, expect, test, vi } from 'vitest';

const createCanonicalVideoMetadataLegacyStoreMock = vi.fn();
const FfmpegIngestPendingThumbnailEnricherAdapterMock = vi.fn();
const JsonIngestPendingVideoReaderAdapterMock = vi.fn();
const FilesystemIngestPreparedVideoWorkspaceAdapterMock = vi.fn();
const FilesystemIngestUploadScanAdapterMock = vi.fn();
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

describe('server ingest pending-upload composition root', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('creates a prewired pending-upload snapshot service from the injected reader', async () => {
    const { createServerIngestServices } = await import('../../../app/composition/server/ingest');
    const readPendingUploads = vi.fn(async () => [
      {
        createdAt: new Date('2026-03-29T00:00:00.000Z'),
        filename: 'pending.mp4',
        id: 'pending-1',
        size: 128,
        thumbnailUrl: '/api/thumbnail-preview/pending.jpg',
        type: 'video/mp4',
      },
    ]);

    const services = createServerIngestServices({
      pendingVideoReader: {
        readPendingUploads,
      },
    });

    await expect(services.loadPendingUploadSnapshot.execute()).resolves.toEqual({
      ok: true,
      data: {
        count: 1,
        files: [expect.objectContaining({ id: 'pending-1' })],
      },
    });
    expect(readPendingUploads).toHaveBeenCalledOnce();
    expect(JsonIngestPendingVideoReaderAdapterMock).not.toHaveBeenCalled();
    expect(FilesystemIngestUploadScanAdapterMock).not.toHaveBeenCalled();
    expect(FfmpegIngestPendingThumbnailEnricherAdapterMock).not.toHaveBeenCalled();
    expect(FilesystemIngestPreparedVideoWorkspaceAdapterMock).not.toHaveBeenCalled();
    expect(createIngestLegacyVideoProcessingMock).not.toHaveBeenCalled();
    expect(createCanonicalVideoMetadataLegacyStoreMock).not.toHaveBeenCalled();
  });

  test('returns a cached default pending-upload snapshot service ready for route composition', async () => {
    createCanonicalVideoMetadataLegacyStoreMock.mockReturnValue({
      listLibraryVideos: vi.fn(async () => []),
      writeVideoRecord: vi.fn(async () => undefined),
    });
    FilesystemIngestUploadScanAdapterMock.mockImplementation(() => ({
      discoverUploads: vi.fn(async () => []),
    }));
    FfmpegIngestPendingThumbnailEnricherAdapterMock.mockImplementation(() => ({
      enrichPendingUploads: vi.fn(async () => []),
    }));
    FilesystemIngestPreparedVideoWorkspaceAdapterMock.mockImplementation(() => ({
      preparePreparedVideo: vi.fn(async () => ({
        duration: 120,
        sourcePath: '/workspace/video.mp4',
      })),
      recoverPreparedVideo: vi.fn(async () => ({
        restoredThumbnail: true,
        retryAvailability: 'restored' as const,
      })),
    }));
    createIngestLegacyVideoProcessingMock.mockReturnValue({
      finalizeSuccessfulVideo: vi.fn(async () => undefined),
      processPreparedVideo: vi.fn(async () => ({
        dashEnabled: true,
        message: 'processed',
      })),
    });
    JsonIngestPendingVideoReaderAdapterMock.mockImplementation(() => ({
      readPendingUploads: vi.fn(async () => []),
    }));

    const { getServerIngestServices } = await import('../../../app/composition/server/ingest');
    const first = getServerIngestServices();
    const second = getServerIngestServices();

    expect(first).toBe(second);
    expect(first.loadPendingUploadSnapshot).toBeDefined();
    await expect(first.loadPendingUploadSnapshot.execute()).resolves.toEqual({
      ok: true,
      data: {
        count: 0,
        files: [],
      },
    });
  });

  test('builds the narrow pending-upload snapshot composition without instantiating ingest write defaults', async () => {
    const readPendingUploads = vi.fn(async () => []);
    JsonIngestPendingVideoReaderAdapterMock.mockImplementation(() => ({
      readPendingUploads,
    }));
    vi.resetModules();

    const { getServerPendingUploadSnapshotServices } = await import('../../../app/composition/server/ingest');
    const first = getServerPendingUploadSnapshotServices();
    const second = getServerPendingUploadSnapshotServices();

    expect(first).toBe(second);
    expect(JsonIngestPendingVideoReaderAdapterMock).toHaveBeenCalledOnce();
    expect(FilesystemIngestUploadScanAdapterMock).not.toHaveBeenCalled();
    expect(FfmpegIngestPendingThumbnailEnricherAdapterMock).not.toHaveBeenCalled();
    expect(FilesystemIngestPreparedVideoWorkspaceAdapterMock).not.toHaveBeenCalled();
    expect(createIngestLegacyVideoProcessingMock).not.toHaveBeenCalled();
    expect(createCanonicalVideoMetadataLegacyStoreMock).not.toHaveBeenCalled();
    await expect(first.loadPendingUploadSnapshot.execute()).resolves.toEqual({
      ok: true,
      data: {
        count: 0,
        files: [],
      },
    });
    expect(readPendingUploads).toHaveBeenCalledOnce();
  });
});
