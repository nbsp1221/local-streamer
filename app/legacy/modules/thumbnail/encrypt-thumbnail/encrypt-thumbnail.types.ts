import type { ThumbnailEncryptionService } from '../shared/thumbnail-encryption.service';

export interface EncryptThumbnailUseCaseRequest {
  videoId: string;
  thumbnailPath: string;
}

export interface EncryptThumbnailUseCaseResponse {
  videoId: string;
  encryptedPath: string;
  originalSize: number;
  encryptedSize: number;
  compressionRatio: number;
}

export interface EncryptThumbnailUseCaseDependencies {
  thumbnailEncryptionService: ThumbnailEncryptionService;
  logger?: Console;
}
