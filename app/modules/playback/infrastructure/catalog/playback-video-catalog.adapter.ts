import { SqliteLibraryVideoMetadataRepository } from '~/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository';
import { getVideoMetadataConfig } from '~/shared/config/video-metadata.server';
import type { VideoCatalogPort } from '../../application/ports/video-catalog.port';

interface PlaybackVideoCatalogRepositoryRecord {
  createdAt: Date;
  description?: string;
  duration: number;
  id: string;
  tags: string[];
  thumbnailUrl?: string;
  title: string;
  videoUrl: string;
}

interface PlaybackVideoCatalogRepository {
  findAll: () => Promise<PlaybackVideoCatalogRepositoryRecord[]>;
}

interface PlaybackVideoCatalogAdapterDependencies {
  repository?: PlaybackVideoCatalogRepository;
}

export class PlaybackVideoCatalogAdapter implements VideoCatalogPort {
  private readonly repository: PlaybackVideoCatalogRepository;

  constructor(deps: PlaybackVideoCatalogAdapterDependencies = {}) {
    if (deps.repository) {
      this.repository = deps.repository;
      return;
    }

    this.repository = new SqliteLibraryVideoMetadataRepository({
      dbPath: getVideoMetadataConfig().sqlitePath,
    });
  }

  async getPlayerVideo(videoId: string) {
    const videos = await this.repository.findAll();
    const currentVideo = videos.find(video => video.id === videoId);

    if (!currentVideo) {
      return null;
    }

    return {
      relatedVideos: findRelatedVideos(currentVideo, videos),
      video: currentVideo,
    };
  }
}

function findRelatedVideos(
  current: PlaybackVideoCatalogRepositoryRecord,
  allVideos: PlaybackVideoCatalogRepositoryRecord[],
) {
  if (current.tags.length === 0) {
    return [];
  }

  const currentTags = new Set(current.tags.map(tag => tag.toLowerCase()));

  return allVideos
    .filter(candidate => candidate.id !== current.id)
    .filter(candidate => candidate.tags.some(tag => currentTags.has(tag.toLowerCase())))
    .slice(0, 10);
}
