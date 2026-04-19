import { describe, expect, test, vi } from 'vitest';
import type { Playlist } from '../../domain/playlist';
import { ReorderPlaylistItemsUseCase } from './reorder-playlist-items.usecase';

function createPlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    createdAt: new Date('2026-03-08T00:00:00.000Z'),
    id: 'playlist-1',
    isPublic: false,
    name: 'Owned Playlist',
    ownerId: 'owner-1',
    type: 'user_created',
    updatedAt: new Date('2026-03-09T00:00:00.000Z'),
    videoIds: ['video-1', 'video-2'],
    ...overrides,
  };
}

describe('ReorderPlaylistItemsUseCase', () => {
  test('rejects new orders that do not contain exactly the current video set', async () => {
    const reorderPlaylistItems = vi.fn();
    const useCase = new ReorderPlaylistItemsUseCase({
      playlistRepository: {
        findById: vi.fn(async () => createPlaylist()),
        reorderPlaylistItems,
      },
    });

    await expect(useCase.execute({
      newOrder: ['video-2'],
      ownerId: 'owner-1',
      playlistId: 'playlist-1',
    })).resolves.toEqual({
      message: 'New order must contain exactly the same videos as current playlist',
      ok: false,
      reason: 'PLAYLIST_REORDER_ERROR',
    });

    expect(reorderPlaylistItems).not.toHaveBeenCalled();
  });

  test('returns reorder details without a public success flag in the application output', async () => {
    const useCase = new ReorderPlaylistItemsUseCase({
      playlistRepository: {
        findById: vi.fn(async () => createPlaylist()),
        reorderPlaylistItems: vi.fn(async () => undefined),
      },
    });

    await expect(useCase.execute({
      newOrder: ['video-2', 'video-1'],
      ownerId: 'owner-1',
      playlistId: 'playlist-1',
    })).resolves.toEqual({
      ok: true,
      data: {
        message: 'Playlist "Owned Playlist" reordered successfully',
        newOrder: ['video-2', 'video-1'],
        oldOrder: ['video-1', 'video-2'],
        playlistName: 'Owned Playlist',
        videosReordered: 2,
      },
    });
  });
});
