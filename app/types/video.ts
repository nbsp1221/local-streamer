export interface Video {
  id: string;
  title: string;
  tags: string[];
  thumbnailUrl: string;
  videoUrl: string;
  duration: number; // seconds
  addedAt: Date;
  description?: string;
}

export interface PendingVideo {
  filename: string;
  size: number; // bytes
  type: string;
  path: string;
}

export interface VideoLibrary {
  videos: Video[];
  pendingVideos: PendingVideo[];
}

export interface SearchFilters {
  query: string;
  tags: string[];
}