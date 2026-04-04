export interface ThumbnailDecryptionInput {
  validateAccess?: boolean;
  videoId: string;
}

export interface ThumbnailDecryptionOutput {
  imageBuffer: Buffer;
  mimeType: string;
  size: number;
  videoId: string;
}

export type ThumbnailDecryptionResult =
  | { success: true; data: ThumbnailDecryptionOutput }
  | { success: false; error: Error };

export interface ThumbnailDecryptionServicePort {
  decryptThumbnail(input: ThumbnailDecryptionInput): Promise<ThumbnailDecryptionResult>;
}
