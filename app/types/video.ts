export interface Video {
  id: string;
  title: string;
  tags: string[];
  thumbnailUrl?: string;
  videoUrl: string;
  duration: number; // seconds
  createdAt: Date;
  description?: string;
}

export interface PendingVideo {
  id: string;
  filename: string;
  size: number; // bytes
  type: string; // mime type
  path?: string;
  thumbnailUrl?: string; // Optional thumbnail preview URL
}

export interface VideoLibrary {
  videos: Video[];
  pendingVideos: PendingVideo[];
}

export interface SearchFilters {
  query: string;
  tags: string[];
}
