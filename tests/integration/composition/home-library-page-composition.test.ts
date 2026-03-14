import { describe, expect, test, vi } from 'vitest';
import type { PendingVideo } from '../../../app/legacy/types/video';
import type { LibraryVideo } from '../../../app/modules/library/domain/library-video';

function createFixtureVideo(overrides: Partial<LibraryVideo> = {}): LibraryVideo {
  return {
    createdAt: new Date('2026-03-11T00:00:00.000Z'),
    duration: 180,
    id: 'video-1',
    tags: ['Action'],
    title: 'Catalog Fixture',
    videoUrl: '/videos/video-1/manifest.mpd',
    ...overrides,
  };
}

function createPendingFixture(overrides: Partial<PendingVideo> = {}): PendingVideo {
  return {
    filename: 'pending.mp4',
    id: 'pending-1',
    size: 128,
    type: 'video/mp4',
    ...overrides,
  };
}

describe('home library page composition root', () => {
  test('composes canonical library data with pending compatibility data and exposes legacy bootstrap filters', async () => {
    const { createHomeLibraryPageServices } = await import('../../../app/composition/server/home-library-page');
    const services = createHomeLibraryPageServices({
      libraryServices: {
        loadLibraryCatalogSnapshot: {
          execute: vi.fn(async () => ({
            ok: true as const,
            data: {
              filters: {
                displayQuery: ' Action ',
                normalizedQuery: 'action',
                normalizedTags: ['action', 'drama'],
                rawTags: ['Action', 'Drama'],
              },
              videos: [createFixtureVideo()],
            },
          })),
        },
      },
      pendingVideosReader: {
        readPendingVideos: vi.fn(async () => [createPendingFixture()]),
      },
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: ' Action ',
      rawTags: ['Action', 'Drama'],
    })).resolves.toEqual({
      ok: true,
      data: {
        videos: [expect.objectContaining({ id: 'video-1' })],
        pendingVideos: [expect.objectContaining({ id: 'pending-1' })],
        initialFilters: {
          query: ' Action ',
          tags: ['Action', 'Drama'],
        },
      },
    });
  });

  test('trims bootstrap tag values before handing them to the legacy HomePage filter contract', async () => {
    const { createHomeLibraryPageServices } = await import('../../../app/composition/server/home-library-page');
    const services = createHomeLibraryPageServices({
      libraryServices: {
        loadLibraryCatalogSnapshot: {
          execute: vi.fn(async () => ({
            ok: true as const,
            data: {
              filters: {
                displayQuery: '',
                normalizedQuery: '',
                normalizedTags: ['action', 'drama'],
                rawTags: ['  Action  ', 'Drama'],
              },
              videos: [createFixtureVideo()],
            },
          })),
        },
      },
      pendingVideosReader: {
        readPendingVideos: vi.fn(async () => []),
      },
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: '',
      rawTags: ['  Action  ', 'Drama'],
    })).resolves.toEqual({
      ok: true,
      data: {
        videos: [expect.objectContaining({ id: 'video-1' })],
        pendingVideos: [],
        initialFilters: {
          query: '',
          tags: ['Action', 'Drama'],
        },
      },
    });
  });

  test('deduplicates repeated tag params before handing them to the legacy HomePage filter contract', async () => {
    const { createHomeLibraryPageServices } = await import('../../../app/composition/server/home-library-page');
    const services = createHomeLibraryPageServices({
      libraryServices: {
        loadLibraryCatalogSnapshot: {
          execute: vi.fn(async () => ({
            ok: true as const,
            data: {
              filters: {
                displayQuery: '',
                normalizedQuery: '',
                normalizedTags: ['action', 'drama'],
                rawTags: ['Action', '  Action  ', 'Drama', 'drama'],
              },
              videos: [createFixtureVideo()],
            },
          })),
        },
      },
      pendingVideosReader: {
        readPendingVideos: vi.fn(async () => []),
      },
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: '',
      rawTags: ['Action', '  Action  ', 'Drama', 'drama'],
    })).resolves.toEqual({
      ok: true,
      data: {
        videos: [expect.objectContaining({ id: 'video-1' })],
        pendingVideos: [],
        initialFilters: {
          query: '',
          tags: ['Action', 'Drama'],
        },
      },
    });
  });

  test('returns an explicit failure when catalog or pending compatibility data is unavailable', async () => {
    const { createHomeLibraryPageServices } = await import('../../../app/composition/server/home-library-page');
    const pendingVideosReader = {
      readPendingVideos: vi
        .fn()
        .mockRejectedValueOnce(new Error('pending unavailable')),
    };
    const catalogExecute = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        reason: 'CATALOG_SOURCE_UNAVAILABLE' as const,
      })
      .mockResolvedValueOnce({
        ok: true as const,
        data: {
          filters: {
            displayQuery: '',
            normalizedQuery: '',
            normalizedTags: [],
            rawTags: [],
          },
          videos: [createFixtureVideo()],
        },
      });
    const services = createHomeLibraryPageServices({
      libraryServices: {
        loadLibraryCatalogSnapshot: {
          execute: catalogExecute,
        },
      },
      pendingVideosReader,
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: '',
      rawTags: [],
    })).resolves.toEqual({
      ok: false,
      reason: 'HOME_DATA_UNAVAILABLE',
    });
    expect(pendingVideosReader.readPendingVideos).not.toHaveBeenCalled();

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: '',
      rawTags: [],
    })).resolves.toEqual({
      ok: false,
      reason: 'HOME_DATA_UNAVAILABLE',
    });
    expect(catalogExecute).toHaveBeenCalledTimes(2);
    expect(pendingVideosReader.readPendingVideos).toHaveBeenCalledOnce();
  });
});
