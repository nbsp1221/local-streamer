import type { Playlist, PlaylistStats } from '../playlist';

export class PlaylistStatsPolicy {
  static build(playlist: Playlist): PlaylistStats {
    return {
      completionRate: 0,
      id: playlist.id,
      lastUpdated: playlist.updatedAt,
      popularityScore: playlist.videoIds.length,
      totalDuration: 0,
      totalVideos: playlist.videoIds.length,
      totalViews: 0,
    };
  }
}
