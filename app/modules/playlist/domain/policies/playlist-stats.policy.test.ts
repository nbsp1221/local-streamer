import { describe, expect, test } from 'vitest';
import type { Playlist } from '../playlist';

function createPlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    createdAt: new Date('2026-03-08T00:00:00.000Z'),
    id: 'playlist-1',
    isPublic: false,
    name: 'Vault',
    ownerId: 'owner-1',
    type: 'user_created',
    updatedAt: new Date('2026-03-09T00:00:00.000Z'),
    videoIds: ['video-1', 'video-2'],
    ...overrides,
  };
}

describe('PlaylistStatsPolicy', () => {
  test('builds the placeholder stats contract from playlist data', async () => {
    const { PlaylistStatsPolicy } = await import('./playlist-stats.policy');

    expect(PlaylistStatsPolicy.build(createPlaylist())).toEqual({
      completionRate: 0,
      id: 'playlist-1',
      lastUpdated: new Date('2026-03-09T00:00:00.000Z'),
      popularityScore: 2,
      totalDuration: 0,
      totalVideos: 2,
      totalViews: 0,
    });
  });
});
