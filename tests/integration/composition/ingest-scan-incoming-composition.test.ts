import { beforeEach, describe, expect, test, vi } from 'vitest';

const createCanonicalVideoMetadataLegacyStoreMock = vi.fn();
const createIngestLegacyPendingThumbnailEnricherMock = vi.fn();
const createIngestLegacyPendingVideoSourceMock = vi.fn();
const createIngestLegacyPreparedVideoWorkspaceMock = vi.fn();
const createIngestLegacyUploadScanMock = vi.fn();
const createIngestLegacyVideoProcessingMock = vi.fn();

vi.mock('~/composition/server/canonical-video-metadata-legacy-store', () => ({
  createCanonicalVideoMetadataLegacyStore: createCanonicalVideoMetadataLegacyStoreMock,
}));

vi.mock('~/composition/server/ingest-legacy-pending-thumbnail-enricher', () => ({
  createIngestLegacyPendingThumbnailEnricher: createIngestLegacyPendingThumbnailEnricherMock,
}));

vi.mock('~/composition/server/ingest-legacy-prepared-video-workspace', () => ({
  createIngestLegacyPreparedVideoWorkspace: createIngestLegacyPreparedVideoWorkspaceMock,
}));

vi.mock('~/composition/server/ingest-legacy-upload-scan', () => ({
  createIngestLegacyUploadScan: createIngestLegacyUploadScanMock,
}));

vi.mock('~/composition/server/ingest-legacy-video-processing', () => ({
  createIngestLegacyVideoProcessing: createIngestLegacyVideoProcessingMock,
}));

vi.mock('~/composition/server/ingest-legacy-pending-video-source', () => ({
  createIngestLegacyPendingVideoSource: createIngestLegacyPendingVideoSourceMock,
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
    expect(createIngestLegacyUploadScanMock).not.toHaveBeenCalled();
    expect(createIngestLegacyPendingThumbnailEnricherMock).not.toHaveBeenCalled();
    expect(createIngestLegacyPendingVideoSourceMock).not.toHaveBeenCalled();
    expect(createIngestLegacyPreparedVideoWorkspaceMock).not.toHaveBeenCalled();
    expect(createIngestLegacyVideoProcessingMock).not.toHaveBeenCalled();
    expect(createCanonicalVideoMetadataLegacyStoreMock).not.toHaveBeenCalled();
  });
});
