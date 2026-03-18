export interface IngestPendingVideo {
  id: string;
  filename: string;
  size: number;
  type: string;
  thumbnailUrl?: string;
  createdAt: Date;
}
