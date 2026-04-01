import type { VideoCatalogPort } from '../../application/ports/video-catalog.port';
import { LegacyVideoCatalogAdapter } from './legacy-video-catalog.adapter';

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

// Temporary playback-owned compatibility seam while catalog data still comes from legacy storage.
export class PlaybackVideoCatalogAdapter implements VideoCatalogPort {
  private readonly delegate: VideoCatalogPort;

  constructor(deps: PlaybackVideoCatalogAdapterDependencies = {}) {
    this.delegate = new LegacyVideoCatalogAdapter(deps);
  }

  async getPlayerVideo(videoId: string) {
    return this.delegate.getPlayerVideo(videoId);
  }
}
