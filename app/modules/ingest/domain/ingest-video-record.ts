export interface IngestVideoRecord {
  contentTypeSlug?: string;
  id: string;
  title: string;
  tags: string[];
  genreSlugs: string[];
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  description?: string;
}
