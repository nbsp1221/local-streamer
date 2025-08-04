export type VideoFormat = 'mp4' | 'webm' | 'mkv' | 'avi';

export interface Video {
  id: string;
  title: string;
  tags: string[];
  thumbnailUrl: string;
  videoUrl: string;
  duration: number; // seconds
  addedAt: Date;
  description?: string;
  format: VideoFormat;
}

export interface PendingVideo {
  filename: string;
  size: number; // bytes
  type: string;
  path: string;
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