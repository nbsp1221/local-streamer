import type { PlaylistItem } from '../../domain/playlist';

export interface PlaylistCatalogVideoSummary {
  duration: number;
  id: string;
  thumbnailUrl?: string;
  title: string;
}

export interface PlaylistCatalogVideo {
  duration: number;
  episodeMetadata?: PlaylistItem['episodeMetadata'];
  id: string;
  position: number;
  thumbnailUrl?: string;
  title: string;
}

export interface PlaylistVideoCatalogPort {
  findById?(videoId: string): Promise<PlaylistCatalogVideoSummary | null>;
  getPlaylistVideos(items: PlaylistItem[]): Promise<PlaylistCatalogVideo[]>;
}
