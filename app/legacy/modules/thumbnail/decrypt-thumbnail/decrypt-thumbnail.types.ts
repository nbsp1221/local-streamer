import type { ThumbnailEncryptionService } from '../shared/thumbnail-encryption.service';

export interface DecryptThumbnailUseCaseRequest {
  videoId: string;
  validateAccess?: boolean;
}

export interface DecryptThumbnailUseCaseResponse {
  imageBuffer: Buffer;
  mimeType: string;
  size: number;
  videoId: string;
}

export interface DecryptThumbnailUseCaseDependencies {
  thumbnailEncryptionService: ThumbnailEncryptionService;
  logger?: Console;
}
