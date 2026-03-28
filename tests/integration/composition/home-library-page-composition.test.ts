import { describe, expect, test, vi } from 'vitest';
import type { PendingLibraryItem } from '../../../app/entities/pending-video/model/pending-video';
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

function createPendingFixture(overrides: Partial<PendingLibraryItem> = {}): PendingLibraryItem {
  return {
    filename: 'pending.mp4',
    id: 'pending-1',
    size: 128,
    type: 'video/mp4',
    ...overrides,
  };
}

describe('home library page composition root', () => {
  test('composes canonical library data with pending library items in the active shape', async () => {
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
      pendingVideosSource: {
        readPendingLibraryItems: vi.fn(async () => [createPendingFixture()]),
      },
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: ' Action ',
      rawTags: ['Action', 'Drama'],
    })).resolves.toEqual({
      ok: true,
      data: {
        pendingVideos: [expect.objectContaining({ id: 'pending-1' })],
        videos: [expect.objectContaining({ id: 'video-1' })],
      },
    });
  });

  test('returns an explicit failure when catalog or pending compatibility data is unavailable', async () => {
    const { createHomeLibraryPageServices } = await import('../../../app/composition/server/home-library-page');
    const pendingVideosSource = {
      readPendingLibraryItems: vi
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
      pendingVideosSource,
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: '',
      rawTags: [],
    })).resolves.toEqual({
      ok: false,
      reason: 'HOME_DATA_UNAVAILABLE',
    });
    expect(pendingVideosSource.readPendingLibraryItems).not.toHaveBeenCalled();

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: '',
      rawTags: [],
    })).resolves.toEqual({
      ok: false,
      reason: 'HOME_DATA_UNAVAILABLE',
    });
    expect(catalogExecute).toHaveBeenCalledTimes(2);
    expect(pendingVideosSource.readPendingLibraryItems).toHaveBeenCalledOnce();
  });
});
