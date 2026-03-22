export interface IngestVideoRecord {
  id: string;
  title: string;
  tags: string[];
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  description?: string;
}
