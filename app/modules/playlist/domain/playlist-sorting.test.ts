import { describe, expect, test } from 'vitest';
import type { Playlist } from './playlist';

function createPlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    createdAt: new Date('2026-03-08T00:00:00.000Z'),
    id: 'playlist-1',
    isPublic: false,
    name: 'Alpha',
    ownerId: 'owner-1',
    type: 'user_created',
    updatedAt: new Date('2026-03-08T00:00:00.000Z'),
    videoIds: ['video-1'],
    ...overrides,
  };
}

describe('sortPlaylists', () => {
  test('sorts playlists by the requested field and order without mutating the source list', async () => {
    const { sortPlaylists } = await import('./playlist-sorting');
    const playlists = [
      createPlaylist({
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        id: 'playlist-b',
        name: 'Bravo',
        updatedAt: new Date('2026-03-09T00:00:00.000Z'),
        videoIds: ['video-1', 'video-2', 'video-3'],
      }),
      createPlaylist({
        createdAt: new Date('2026-03-09T00:00:00.000Z'),
        id: 'playlist-a',
        name: 'Alpha',
        updatedAt: new Date('2026-03-11T00:00:00.000Z'),
        videoIds: ['video-1'],
      }),
    ];

    expect(sortPlaylists(playlists, {
      sortBy: 'name',
      sortOrder: 'asc',
    }).map(playlist => playlist.id)).toEqual(['playlist-a', 'playlist-b']);
    expect(sortPlaylists(playlists, {
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    }).map(playlist => playlist.id)).toEqual(['playlist-a', 'playlist-b']);
    expect(sortPlaylists(playlists, {
      sortBy: 'videoCount',
      sortOrder: 'desc',
    }).map(playlist => playlist.id)).toEqual(['playlist-b', 'playlist-a']);
    expect(playlists.map(playlist => playlist.id)).toEqual(['playlist-b', 'playlist-a']);
  });
});
