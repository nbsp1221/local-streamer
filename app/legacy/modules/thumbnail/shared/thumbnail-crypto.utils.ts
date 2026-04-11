import crypto from 'crypto';
import {
  type EncryptedThumbnailHeader,
  type ThumbnailDecryptionResult,
  type ThumbnailEncryptionResult,
  THUMBNAIL_IV_SIZE,
} from './thumbnail-encryption.types';

/**
 * Thumbnail cryptographic utilities using AES-128-CBC
 */
export class ThumbnailCryptoUtils {
  private static readonly ALGORITHM = 'aes-128-cbc';

  /**
   * Generate a random 16-byte IV for AES-128
   */
  static generateIV(): Buffer {
    return crypto.randomBytes(THUMBNAIL_IV_SIZE);
  }

  /**
   * Encrypt image data with AES-128-CBC and prepend IV to the result
   * Format: [16 bytes IV][Encrypted data]
   */
  static encryptWithIVHeader(imageData: Buffer, key: Buffer): ThumbnailEncryptionResult {
    try {
      // Generate random IV
      const iv = this.generateIV();

      // Create cipher
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

      // Encrypt the image data
      const encryptedChunks: Buffer[] = [];
      encryptedChunks.push(cipher.update(imageData));
      encryptedChunks.push(cipher.final());

      const encryptedData = Buffer.concat(encryptedChunks);

      // Combine IV + encrypted data
      const result = Buffer.concat([iv, encryptedData]);

      return {
        success: true,
        data: result,
      };
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Encryption failed',
      };
    }
  }

  /**
   * Extract IV and encrypted data from the header format
   * Format: [16 bytes IV][Encrypted data]
   */
  static parseEncryptedHeader(encryptedBuffer: Buffer): EncryptedThumbnailHeader | null {
    if (encryptedBuffer.length < THUMBNAIL_IV_SIZE) {
      return null;
    }

    const iv = encryptedBuffer.subarray(0, THUMBNAIL_IV_SIZE);
    const encryptedData = encryptedBuffer.subarray(THUMBNAIL_IV_SIZE);

    return { iv, encryptedData };
  }

  /**
   * Decrypt image data using the IV from the header
   */
  static decryptWithIVHeader(encryptedBuffer: Buffer, key: Buffer): ThumbnailDecryptionResult {
    try {
      // Parse the header
      const header = this.parseEncryptedHeader(encryptedBuffer);
      if (!header) {
        return {
          success: false,
          error: 'Invalid encrypted thumbnail format: missing or corrupt IV header',
        };
      }

      // Create decipher
      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, header.iv);

      // Decrypt the data
      const decryptedChunks: Buffer[] = [];
      decryptedChunks.push(decipher.update(header.encryptedData));
      decryptedChunks.push(decipher.final());

      const decryptedData = Buffer.concat(decryptedChunks);

      return {
        success: true,
        data: decryptedData,
      };
    }
    catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Decryption failed',
      };
    }
  }

  /**
   * Verify that the encrypted data has valid structure
   * Checks if the file follows our encrypted format and is not a plain JPEG
   */
  static validateEncryptedFormat(encryptedBuffer: Buffer): boolean {
    // Basic length check
    if (encryptedBuffer.length <= THUMBNAIL_IV_SIZE) {
      return false;
    }

    // Check if it starts with JPEG magic bytes (indicating it's unencrypted)
    if (encryptedBuffer.length >= 2 &&
      encryptedBuffer[0] === 0xFF &&
      encryptedBuffer[1] === 0xD8) {
      return false; // This is a plain JPEG file
    }

    // Additional validation: encrypted data should not have recognizable patterns
    // The first 16 bytes should be random IV, not structured data
    const firstBytes = encryptedBuffer.subarray(0, Math.min(4, encryptedBuffer.length));

    // Check for other common image format magic bytes
    const magicBytes = Array.from(firstBytes);

    // PNG magic bytes: 89 50 4E 47
    if (magicBytes.length >= 4 &&
      magicBytes[0] === 0x89 && magicBytes[1] === 0x50 &&
      magicBytes[2] === 0x4E && magicBytes[3] === 0x47) {
      return false;
    }

    // WebP magic bytes: starts with RIFF
    if (magicBytes.length >= 4 &&
      magicBytes[0] === 0x52 && magicBytes[1] === 0x49 &&
      magicBytes[2] === 0x46 && magicBytes[3] === 0x46) {
      return false;
    }

    return true; // Likely encrypted data
  }

  static looksLikeJpeg(buffer: Buffer | undefined): buffer is Buffer {
    if (!buffer || buffer.length < 4) {
      return false;
    }

    if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
      return false;
    }

    if (buffer[buffer.length - 2] !== 0xFF || buffer[buffer.length - 1] !== 0xD9) {
      return false;
    }

    let cursor = 2;
    let sawFrameMarker = false;
    let sawScanHeaderDependency = false;
    let sawStartOfScan = false;

    while (cursor < buffer.length) {
      const segment = readNextJpegSegment(buffer, cursor);
      if (!segment) {
        return false;
      }

      if (segment.marker === 0xD9) {
        return sawStartOfScan
          && sawFrameMarker
          && sawScanHeaderDependency
          && segment.nextCursor === buffer.length;
      }

      cursor = segment.nextCursor;

      if (segment.isStandalone) {
        continue;
      }

      if (!validateJpegSegment(segment, buffer)) {
        return false;
      }

      if (isScanHeaderDependencyMarker(segment.marker)) {
        sawScanHeaderDependency = true;
      }

      if (isStartOfFrameMarker(segment.marker)) {
        sawFrameMarker = true;
      }

      if (segment.marker === 0xDA) {
        if (!sawFrameMarker || !sawScanHeaderDependency) {
          return false;
        }

        sawStartOfScan = true;
        cursor = readNextScanMarkerOffset(buffer, segment.segmentEnd);

        if (cursor === -1) {
          return false;
        }

        continue;
      }

      cursor = segment.segmentEnd;
    }

    return false;
  }
}

interface JpegSegment {
  isStandalone: boolean;
  marker: number;
  nextCursor: number;
  segmentDataStart: number;
  segmentEnd: number;
  segmentLength: number;
}

function readNextJpegMarkerOffset(
  buffer: Buffer,
  startIndex: number,
): number {
  for (let index = Math.max(startIndex, 0); index < buffer.length - 1; index += 1) {
    if (buffer[index] === 0xFF && buffer[index + 1] !== 0x00 && buffer[index + 1] !== 0xFF) {
      return index;
    }
  }

  return -1;
}

function readNextJpegSegment(
  buffer: Buffer,
  startIndex: number,
): JpegSegment | null {
  const markerOffset = readNextJpegMarkerOffset(buffer, startIndex);

  if (markerOffset === -1 || markerOffset + 1 >= buffer.length) {
    return null;
  }

  const marker = buffer[markerOffset + 1];
  const nextCursor = markerOffset + 2;

  if (marker === 0xD9 || isStandaloneJpegMarker(marker)) {
    return {
      isStandalone: true,
      marker,
      nextCursor,
      segmentDataStart: nextCursor,
      segmentEnd: nextCursor,
      segmentLength: 0,
    };
  }

  if (nextCursor + 1 >= buffer.length) {
    return null;
  }

  const segmentLength = buffer.readUInt16BE(nextCursor);
  if (segmentLength < 2) {
    return null;
  }

  const segmentDataStart = nextCursor + 2;
  const segmentEnd = nextCursor + segmentLength;
  if (segmentEnd > buffer.length) {
    return null;
  }

  return {
    isStandalone: false,
    marker,
    nextCursor,
    segmentDataStart,
    segmentEnd,
    segmentLength,
  };
}

function readNextScanMarkerOffset(buffer: Buffer, startIndex: number): number {
  let cursor = startIndex;

  while (cursor < buffer.length - 1) {
    if (buffer[cursor] !== 0xFF) {
      cursor += 1;
      continue;
    }

    const marker = buffer[cursor + 1];

    if (marker === 0x00) {
      cursor += 2;
      continue;
    }

    if (marker >= 0xD0 && marker <= 0xD7) {
      cursor += 2;
      continue;
    }

    if (marker === 0xFF) {
      cursor += 1;
      continue;
    }

    return cursor;
  }

  return -1;
}

function isStandaloneJpegMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xD0 && marker <= 0xD8);
}

function isStartOfFrameMarker(marker: number): boolean {
  return (marker >= 0xC0 && marker <= 0xC3)
    || (marker >= 0xC5 && marker <= 0xC7)
    || (marker >= 0xC9 && marker <= 0xCB)
    || (marker >= 0xCD && marker <= 0xCF);
}

function validateJpegSegment(
  segment: JpegSegment,
  buffer: Buffer,
): boolean {
  if (segment.marker === 0xDA) {
    return validateStartOfScanSegment(buffer, segment.segmentDataStart, segment.segmentLength);
  }

  if (isStartOfFrameMarker(segment.marker)) {
    return validateStartOfFrameSegment(buffer, segment.segmentDataStart, segment.segmentLength);
  }

  if (segment.marker === 0xDD) {
    return segment.segmentLength === 4;
  }

  if (segment.marker === 0xDB) {
    return segment.segmentLength >= 67;
  }

  if (segment.marker === 0xC4) {
    return segment.segmentLength >= 19;
  }

  return segment.segmentLength >= 2;
}

function isScanHeaderDependencyMarker(marker: number): boolean {
  return marker === 0xDB || marker === 0xC4 || marker === 0xDD;
}

function validateStartOfFrameSegment(
  buffer: Buffer,
  segmentDataStart: number,
  segmentLength: number,
): boolean {
  if (segmentLength < 11) {
    return false;
  }

  const componentCountOffset = segmentDataStart + 5;
  if (componentCountOffset >= buffer.length) {
    return false;
  }

  const componentCount = buffer[componentCountOffset];
  if (componentCount < 1) {
    return false;
  }

  return segmentLength === 8 + (componentCount * 3);
}

function validateStartOfScanSegment(
  buffer: Buffer,
  segmentDataStart: number,
  segmentLength: number,
): boolean {
  if (segmentLength < 8) {
    return false;
  }

  const componentCountOffset = segmentDataStart;
  if (componentCountOffset >= buffer.length) {
    return false;
  }

  const componentCount = buffer[componentCountOffset];
  if (componentCount < 1) {
    return false;
  }

  return segmentLength === 6 + (componentCount * 2);
}
