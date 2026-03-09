export interface PlaybackCatalogVideo {
  createdAt: Date;
  description?: string;
  duration: number;
  id: string;
  tags: string[];
  thumbnailUrl?: string;
  title: string;
  videoUrl: string;
}

export interface PlayerVideoResult {
  relatedVideos: PlaybackCatalogVideo[];
  video: PlaybackCatalogVideo;
}

export interface VideoCatalogPort {
  getPlayerVideo: (videoId: string) => Promise<PlayerVideoResult | null>;
}
