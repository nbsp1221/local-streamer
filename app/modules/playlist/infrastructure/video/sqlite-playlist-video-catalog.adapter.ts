import type { PlaylistItem } from '~/modules/playlist/domain/playlist';
import { SqliteLibraryVideoMetadataRepository } from '~/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository';
import { getVideoMetadataConfig } from '~/shared/config/video-metadata.server';

export class SqlitePlaylistVideoCatalog {
  private readonly repository = new SqliteLibraryVideoMetadataRepository({
    dbPath: getVideoMetadataConfig().sqlitePath,
  });

  async findById(videoId: string) {
    const video = await this.repository.findById(videoId);

    if (!video) {
      return null;
    }

    return {
      duration: video.duration,
      id: video.id,
      thumbnailUrl: video.thumbnailUrl,
      title: video.title,
    };
  }

  async getPlaylistVideos(items: PlaylistItem[]) {
    const resolvedVideos = await Promise.all(items.map(async (item) => {
      const video = await this.repository.findById(item.videoId);

      if (!video) {
        return null;
      }

      return {
        duration: video.duration,
        id: video.id,
        episodeMetadata: item.episodeMetadata,
        position: item.position,
        thumbnailUrl: video.thumbnailUrl,
        title: video.title,
      } satisfies {
        duration: number;
        id: string;
        position: number;
        thumbnailUrl?: string;
        title: string;
        episodeMetadata?: PlaylistItem['episodeMetadata'];
      };
    }));

    return resolvedVideos.filter(video => video !== null);
  }
}
