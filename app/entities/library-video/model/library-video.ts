export interface HomeLibraryVideo {
  contentTypeSlug?: string;
  id: string;
  title: string;
  tags: string[];
  genreSlugs?: string[];
  thumbnailUrl?: string;
  videoUrl: string;
  duration: number;
  createdAt: Date;
  description?: string;
}
