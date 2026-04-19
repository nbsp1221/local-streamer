import { describe, expect, test, vi } from 'vitest';
import type { Playlist } from '../../domain/playlist';
import { FindPlaylistsUseCase } from './find-playlists.usecase';

function createPlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    createdAt: new Date('2026-03-08T00:00:00.000Z'),
    id: 'playlist-1',
    isPublic: false,
    name: 'Vault',
    ownerId: 'owner-1',
    type: 'user_created',
    updatedAt: new Date('2026-03-08T00:00:00.000Z'),
    videoIds: ['video-1'],
    ...overrides,
  };
}

describe('FindPlaylistsUseCase', () => {
  test('filters inaccessible and empty playlists, then sorts, paginates, and optionally adds stats', async () => {
    const findWithFilters = vi.fn(async () => [
      createPlaylist({
        id: 'playlist-visible-large',
        isPublic: true,
        name: 'Visible Large',
        ownerId: 'other-user',
        videoIds: ['video-1', 'video-2', 'video-3'],
      }),
      createPlaylist({
        id: 'playlist-owner-small',
        name: 'Owner Small',
        ownerId: 'owner-1',
        videoIds: ['video-1'],
      }),
      createPlaylist({
        id: 'playlist-owner-empty',
        name: 'Owner Empty',
        ownerId: 'owner-1',
        videoIds: [],
      }),
      createPlaylist({
        id: 'playlist-private-other',
        isPublic: false,
        name: 'Private Other',
        ownerId: 'other-user',
        videoIds: ['video-9'],
      }),
    ]);
    const useCase = new FindPlaylistsUseCase({
      playlistRepository: {
        findWithFilters,
      },
    });

    const result = await useCase.execute({
      filters: {
        genre: ['Action'],
        searchQuery: 'vault',
      },
      includeEmpty: false,
      includeStats: true,
      limit: 1,
      offset: 0,
      ownerId: 'owner-1',
      sortBy: 'videoCount',
      sortOrder: 'desc',
    });

    expect(findWithFilters).toHaveBeenCalledWith({
      genre: ['Action'],
      searchQuery: 'vault',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        filters: {
          genre: ['Action'],
          searchQuery: 'vault',
        },
        hasMore: true,
        pagination: {
          currentPage: 1,
          limit: 1,
          offset: 0,
          totalPages: 2,
        },
        playlists: [
          expect.objectContaining({
            id: 'playlist-visible-large',
          }),
        ],
        stats: [
          expect.objectContaining({
            id: 'playlist-visible-large',
            totalVideos: 3,
          }),
        ],
        totalCount: 2,
      },
    });
  });

  test('returns an explicit validation failure for unsupported pagination values', async () => {
    const useCase = new FindPlaylistsUseCase({
      playlistRepository: {
        findWithFilters: vi.fn(),
      },
    });

    await expect(useCase.execute({
      filters: {},
      includeEmpty: true,
      includeStats: false,
      limit: 0,
      offset: 0,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })).resolves.toEqual({
      message: 'Limit must be an integer between 1 and 100',
      ok: false,
      reason: 'VALIDATION_ERROR',
    });
  });

  test('rejects non-finite, fractional, and negative pagination inputs before touching the repository', async () => {
    const findWithFilters = vi.fn();
    const useCase = new FindPlaylistsUseCase({
      playlistRepository: {
        findWithFilters,
      },
    });

    await expect(useCase.execute({
      filters: {},
      includeEmpty: true,
      includeStats: false,
      limit: Number.NaN,
      offset: 0,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })).resolves.toEqual({
      message: 'Limit must be an integer between 1 and 100',
      ok: false,
      reason: 'VALIDATION_ERROR',
    });

    await expect(useCase.execute({
      filters: {},
      includeEmpty: true,
      includeStats: false,
      limit: 20,
      offset: 1.5,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })).resolves.toEqual({
      message: 'Offset must be a non-negative integer',
      ok: false,
      reason: 'VALIDATION_ERROR',
    });

    await expect(useCase.execute({
      filters: {},
      includeEmpty: true,
      includeStats: false,
      limit: Number.POSITIVE_INFINITY,
      offset: -1,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    })).resolves.toEqual({
      message: 'Limit must be an integer between 1 and 100',
      ok: false,
      reason: 'VALIDATION_ERROR',
    });

    expect(findWithFilters).not.toHaveBeenCalled();
  });
});
