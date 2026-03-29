import { afterEach, describe, expect, test, vi } from 'vitest';

const createCanonicalVideoMetadataLegacyStoreMock = vi.fn();
const createIngestLegacyIncomingVideoSourceMock = vi.fn();
const createIngestLegacyLibraryIntakeMock = vi.fn();
const createIngestLegacyPendingVideoSourceMock = vi.fn();

vi.mock('~/composition/server/canonical-video-metadata-legacy-store', () => ({
  createCanonicalVideoMetadataLegacyStore: createCanonicalVideoMetadataLegacyStoreMock,
}));

vi.mock('~/composition/server/ingest-legacy-incoming-video-source', () => ({
  createIngestLegacyIncomingVideoSource: createIngestLegacyIncomingVideoSourceMock,
}));

vi.mock('~/composition/server/ingest-legacy-library-intake', () => ({
  createIngestLegacyLibraryIntake: createIngestLegacyLibraryIntakeMock,
}));

vi.mock('~/composition/server/ingest-legacy-pending-video-source', () => ({
  createIngestLegacyPendingVideoSource: createIngestLegacyPendingVideoSourceMock,
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
    expect(createIngestLegacyPendingVideoSourceMock).not.toHaveBeenCalled();
    expect(createIngestLegacyIncomingVideoSourceMock).not.toHaveBeenCalled();
    expect(createIngestLegacyLibraryIntakeMock).not.toHaveBeenCalled();
    expect(createCanonicalVideoMetadataLegacyStoreMock).not.toHaveBeenCalled();
  });

  test('returns a cached default pending-upload snapshot service ready for route composition', async () => {
    createCanonicalVideoMetadataLegacyStoreMock.mockReturnValue({
      listLibraryVideos: vi.fn(async () => []),
      writeVideoRecord: vi.fn(async () => undefined),
    });
    createIngestLegacyIncomingVideoSourceMock.mockReturnValue({
      scanIncomingVideos: vi.fn(async () => []),
    });
    createIngestLegacyLibraryIntakeMock.mockReturnValue({
      finalizeSuccessfulPreparedVideo: vi.fn(async () => undefined),
      prepareVideoForLibrary: vi.fn(async () => ({
        duration: 120,
        sourcePath: '/workspace/video.mp4',
      })),
      processPreparedVideo: vi.fn(async () => ({
        dashEnabled: true,
        message: 'processed',
      })),
      recoverFailedPreparedVideo: vi.fn(async () => ({
        restoredThumbnail: true,
        retryAvailability: 'restored' as const,
      })),
    });
    createIngestLegacyPendingVideoSourceMock.mockReturnValue({
      readPendingUploads: vi.fn(async () => []),
    });

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
    createIngestLegacyPendingVideoSourceMock.mockReturnValue({
      readPendingUploads,
    });
    vi.resetModules();

    const { getServerPendingUploadSnapshotServices } = await import('../../../app/composition/server/ingest');
    const first = getServerPendingUploadSnapshotServices();
    const second = getServerPendingUploadSnapshotServices();

    expect(first).toBe(second);
    expect(createIngestLegacyPendingVideoSourceMock).toHaveBeenCalledOnce();
    expect(createIngestLegacyIncomingVideoSourceMock).not.toHaveBeenCalled();
    expect(createIngestLegacyLibraryIntakeMock).not.toHaveBeenCalled();
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
