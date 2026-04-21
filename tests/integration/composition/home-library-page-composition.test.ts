import { afterEach, describe, expect, test, vi } from 'vitest';
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

describe('home library page composition root', () => {
  afterEach(async () => {
    vi.resetModules();
  });

  test('composes canonical library data through library services only', async () => {
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
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: ' Action ',
      rawTags: ['Action', 'Drama'],
    })).resolves.toEqual({
      ok: true,
      data: {
        videos: [expect.objectContaining({ id: 'video-1' })],
      },
    });
  });

  test('returns an explicit failure when catalog data is unavailable', async () => {
    const { createHomeLibraryPageServices } = await import('../../../app/composition/server/home-library-page');
    const catalogExecute = vi
      .fn()
      .mockResolvedValue({
        ok: false as const,
        reason: 'CATALOG_SOURCE_UNAVAILABLE' as const,
      });
    const services = createHomeLibraryPageServices({
      libraryServices: {
        loadLibraryCatalogSnapshot: {
          execute: catalogExecute,
        },
      },
    });

    await expect(services.loadHomeLibraryPageData.execute({
      rawQuery: '',
      rawTags: [],
    })).resolves.toEqual({
      ok: false,
      reason: 'HOME_DATA_UNAVAILABLE',
    });
    expect(catalogExecute).toHaveBeenCalledOnce();
  });
});
