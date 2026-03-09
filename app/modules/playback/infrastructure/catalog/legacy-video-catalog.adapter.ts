import type { Video } from '~/legacy/types/video';
import { getVideoRepository } from '~/legacy/repositories';
import type { PlayerVideoResult, VideoCatalogPort } from '../../application/ports/video-catalog.port';

interface LegacyVideoRepository {
  findAll: () => Promise<Video[]>;
}

interface LegacyVideoCatalogAdapterDependencies {
  repository?: LegacyVideoRepository;
}

// Temporary Phase 2 compatibility adapter. Canonical video ownership remains in legacy until Phase 3.
export class LegacyVideoCatalogAdapter implements VideoCatalogPort {
  private readonly repository: LegacyVideoRepository;

  constructor(deps: LegacyVideoCatalogAdapterDependencies = {}) {
    this.repository = deps.repository ?? getVideoRepository();
  }

  async getPlayerVideo(videoId: string): Promise<PlayerVideoResult | null> {
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

function findRelatedVideos(current: Video, allVideos: Video[]): Video[] {
  if (current.tags.length === 0) {
    return [];
  }

  const currentTags = new Set(current.tags.map(tag => tag.toLowerCase()));

  return allVideos
    .filter(candidate => candidate.id !== current.id)
    .filter(candidate => candidate.tags.some(tag => currentTags.has(tag.toLowerCase())))
    .slice(0, 10);
}
