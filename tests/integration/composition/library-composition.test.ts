import { afterEach, describe, expect, test, vi } from 'vitest';

const createCanonicalVideoMetadataLegacyStoreMock = vi.fn();
const createLegacyArtifactRemovalPortMock = vi.fn();
const createLegacyMutationPortMock = vi.fn();

vi.mock('~/composition/server/canonical-video-metadata-legacy-store', () => ({
  createCanonicalVideoMetadataLegacyStore: createCanonicalVideoMetadataLegacyStoreMock,
}));

vi.mock('~/composition/server/library-legacy-video-mutation', () => ({
  createLibraryLegacyVideoArtifactRemovalPort: createLegacyArtifactRemovalPortMock,
  createLibraryLegacyVideoMutationPort: createLegacyMutationPortMock,
}));

describe('server library composition root', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('creates prewired library catalog services from injected adapters', async () => {
    const { createServerLibraryServices } = await import('../../../app/composition/server/library');
    const listLibraryVideos = vi.fn(async () => [
      {
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
        duration: 180,
        id: 'video-1',
        tags: ['Action'],
        title: 'Catalog Fixture',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    ]);

    const services = createServerLibraryServices({
      videoSource: {
        listLibraryVideos,
      },
    });
    const result = await services.loadLibraryCatalogSnapshot.execute({
      rawQuery: 'Action',
      rawTags: ['Action'],
    });

    expect(listLibraryVideos).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      data: {
        videos: [
          expect.objectContaining({
            id: 'video-1',
            title: 'Catalog Fixture',
          }),
        ],
        filters: {
          displayQuery: 'Action',
          normalizedQuery: 'action',
          rawTags: ['Action'],
          normalizedTags: ['action'],
        },
      },
    });
  });

  test('returns a cached default library composition that stays ready for route usage', async () => {
    const listLibraryVideos = vi.fn(async () => [
      {
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
        duration: 180,
        id: 'video-1',
        tags: ['Action'],
        title: 'Catalog Fixture',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    ]);
    createCanonicalVideoMetadataLegacyStoreMock.mockReturnValue({
      listLibraryVideos,
      writeVideoRecord: vi.fn(),
    });
    createLegacyArtifactRemovalPortMock.mockReturnValue({
      cleanupVideoArtifacts: vi.fn(async () => ({})),
    });
    createLegacyMutationPortMock.mockReturnValue({
      deleteLibraryVideo: vi.fn(async () => ({
        deleted: true,
        title: 'Catalog Fixture',
      })),
      findLibraryVideoById: vi.fn(async videoId => ({
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
        duration: 180,
        id: videoId,
        tags: ['Action'],
        title: 'Catalog Fixture',
        videoUrl: '/videos/video-1/manifest.mpd',
      })),
      updateLibraryVideo: vi.fn(async input => ({
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
        duration: 180,
        id: input.videoId,
        tags: input.tags,
        title: input.title,
        videoUrl: '/videos/video-1/manifest.mpd',
      })),
    });
    vi.resetModules();

    const { getServerLibraryServices } = await import('../../../app/composition/server/library');
    const first = getServerLibraryServices();
    const second = getServerLibraryServices();

    expect(first).toBe(second);
    expect(createCanonicalVideoMetadataLegacyStoreMock).toHaveBeenCalledOnce();
    await expect(first.loadLibraryCatalogSnapshot.execute({
      rawQuery: '',
      rawTags: [],
    })).resolves.toEqual({
      ok: true,
      data: {
        videos: [
          expect.objectContaining({
            id: 'video-1',
          }),
        ],
        filters: {
          displayQuery: '',
          normalizedQuery: '',
          rawTags: [],
          normalizedTags: [],
        },
      },
    });
    expect(listLibraryVideos).toHaveBeenCalledOnce();
  });
});
