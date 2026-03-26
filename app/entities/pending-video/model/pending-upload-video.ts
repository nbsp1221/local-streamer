export interface PendingUploadVideo {
  id: string;
  filename: string;
  size: number;
  type: string;
  createdAt: Date | string;
  thumbnailUrl?: string;
}
