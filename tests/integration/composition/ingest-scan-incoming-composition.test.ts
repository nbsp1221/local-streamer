import { beforeEach, describe, expect, test, vi } from 'vitest';

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

describe('ingest scan-incoming composition', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('creates scan-incoming from narrow ingest overrides without constructing the broad legacy scan source', async () => {
    const { createServerIngestServices } = await import('../../../app/composition/server/ingest');
    const discoverUploads = vi.fn(async () => [
      {
        createdAt: new Date('2026-03-30T00:00:00.000Z'),
        filename: 'fixture-video.mp4',
        id: 'fixture-video',
        size: 1_024,
        type: 'video/mp4',
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
      thumbnailUrl: `/api/thumbnail-preview/${file.id}.jpg`,
    })));

    const services = createServerIngestServices({
      uploadScan: {
        discoverUploads,
      },
      pendingThumbnailEnricher: {
        enrichPendingUploads,
      },
    } as never);

    await expect(services.scanIncomingVideos.execute()).resolves.toEqual({
      ok: true,
      data: {
        count: 1,
        files: [
          expect.objectContaining({
            filename: 'fixture-video.mp4',
            id: 'fixture-video',
            thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
          }),
        ],
      },
    });
    expect(discoverUploads).toHaveBeenCalledOnce();
    expect(enrichPendingUploads).toHaveBeenCalledOnce();
    expect(FilesystemIngestUploadScanAdapterMock).not.toHaveBeenCalled();
    expect(FfmpegIngestPendingThumbnailEnricherAdapterMock).not.toHaveBeenCalled();
    expect(JsonIngestPendingVideoReaderAdapterMock).not.toHaveBeenCalled();
    expect(FilesystemIngestPreparedVideoWorkspaceAdapterMock).not.toHaveBeenCalled();
    expect(createIngestLegacyVideoProcessingMock).not.toHaveBeenCalled();
    expect(createCanonicalVideoMetadataLegacyStoreMock).not.toHaveBeenCalled();
  });
});
