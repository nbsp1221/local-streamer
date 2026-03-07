/**
 * Thumbnail encryption related types
 */

export interface EncryptThumbnailRequest {
  videoId: string;
  thumbnailPath: string;
}

export interface EncryptThumbnailResponse {
  success: boolean;
  encryptedPath: string;
  originalSize: number;
  encryptedSize: number;
}

export interface DecryptThumbnailRequest {
  videoId: string;
  validateAccess?: boolean;
}

export interface DecryptThumbnailResponse {
  imageBuffer: Buffer;
  mimeType: string;
  size: number;
}

export interface ThumbnailEncryptionResult {
  success: boolean;
  data?: Buffer;
  error?: string;
}

export interface ThumbnailDecryptionResult {
  success: boolean;
  data?: Buffer;
  error?: string;
}

/**
 * Encrypted thumbnail file format:
 * [16 bytes IV][Encrypted image data]
 */
export interface EncryptedThumbnailHeader {
  iv: Buffer;
  encryptedData: Buffer;
}

export const THUMBNAIL_IV_SIZE = 16; // AES-128 requires 16-byte IV
export const ENCRYPTED_THUMBNAIL_EXTENSION = '.jpg';
