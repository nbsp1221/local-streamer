export type VideoFormat = 'mp4' | 'webm' | 'mkv' | 'avi';

export interface Video {
  id: string;
  title: string;
  tags: string[];
  thumbnailUrl?: string;
  videoUrl: string;
  duration: number; // seconds
  addedAt: Date;
  description?: string;
  format: string;
}

export interface PendingVideo {
  id: string;
  filename: string;
  size: number; // bytes
  type: string; // mime type
  format: string;
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