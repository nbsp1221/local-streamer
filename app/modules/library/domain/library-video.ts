export interface LibraryVideo {
  id: string;
  title: string;
  tags: string[];
  thumbnailUrl?: string;
  videoUrl: string;
  duration: number;
  createdAt: Date;
  description?: string;
}
