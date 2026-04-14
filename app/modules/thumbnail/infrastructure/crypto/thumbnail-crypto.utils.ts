import crypto from 'node:crypto';

const THUMBNAIL_IV_SIZE = 16;
const ALGORITHM = 'aes-128-cbc';

export function encryptWithIVHeader(imageData: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(THUMBNAIL_IV_SIZE);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encryptedData = Buffer.concat([
    cipher.update(imageData),
    cipher.final(),
  ]);

  return Buffer.concat([iv, encryptedData]);
}

export function decryptWithIVHeader(encryptedBuffer: Buffer, key: Buffer): Buffer {
  if (encryptedBuffer.length < THUMBNAIL_IV_SIZE) {
    throw new Error('Invalid encrypted thumbnail format: missing or corrupt IV header');
  }

  const iv = encryptedBuffer.subarray(0, THUMBNAIL_IV_SIZE);
  const encryptedData = encryptedBuffer.subarray(THUMBNAIL_IV_SIZE);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  return Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);
}

export function validateEncryptedFormat(encryptedBuffer: Buffer): boolean {
  if (encryptedBuffer.length <= THUMBNAIL_IV_SIZE) {
    return false;
  }

  // The first bytes are a random IV, so prefix-based magic-byte checks create
  // false negatives for valid ciphertext. Keep this as a light-weight
  // plaintext-JPEG rejection helper only; active service paths should validate
  // encrypted thumbnails through decrypt + JPEG verification when the key is available.
  return !looksLikeJpeg(encryptedBuffer);
}

export function looksLikeJpeg(buffer: Buffer | undefined): buffer is Buffer {
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
      return sawStartOfScan &&
        sawFrameMarker &&
        sawScanHeaderDependency &&
        segment.nextCursor === buffer.length;
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

interface JpegSegment {
  isStandalone: boolean;
  marker: number;
  nextCursor: number;
  segmentDataStart: number;
  segmentEnd: number;
  segmentLength: number;
}

function readNextJpegMarkerOffset(buffer: Buffer, startIndex: number): number {
  for (let index = Math.max(startIndex, 0); index < buffer.length - 1; index += 1) {
    if (buffer[index] === 0xFF && buffer[index + 1] !== 0x00 && buffer[index + 1] !== 0xFF) {
      return index;
    }
  }

  return -1;
}

function readNextScanMarkerOffset(buffer: Buffer, startIndex: number): number {
  return readNextJpegMarkerOffset(buffer, startIndex);
}

function readNextJpegSegment(buffer: Buffer, startIndex: number): JpegSegment | null {
  const markerOffset = readNextJpegMarkerOffset(buffer, startIndex);
  if (markerOffset === -1 || markerOffset + 1 >= buffer.length) {
    return null;
  }

  const marker = buffer[markerOffset + 1];
  const isStandalone = isStandaloneJpegMarker(marker);
  const nextCursor = markerOffset + 2;

  if (isStandalone) {
    return {
      isStandalone: true,
      marker,
      nextCursor,
      segmentDataStart: nextCursor,
      segmentEnd: nextCursor,
      segmentLength: 0,
    };
  }

  if (markerOffset + 3 >= buffer.length) {
    return null;
  }

  const segmentLength = buffer.readUInt16BE(markerOffset + 2);
  const segmentDataStart = markerOffset + 4;
  const segmentEnd = markerOffset + 2 + segmentLength;

  if (segmentLength < 2 || segmentEnd > buffer.length) {
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

function isStandaloneJpegMarker(marker: number): boolean {
  return marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01;
}

function isStartOfFrameMarker(marker: number): boolean {
  return (marker >= 0xC0 && marker <= 0xC3) ||
    (marker >= 0xC5 && marker <= 0xC7) ||
    (marker >= 0xC9 && marker <= 0xCB) ||
    (marker >= 0xCD && marker <= 0xCF);
}

function isScanHeaderDependencyMarker(marker: number): boolean {
  return marker === 0xC4 || marker === 0xDB;
}

function validateJpegSegment(segment: JpegSegment, buffer: Buffer): boolean {
  const payloadLength = segment.segmentLength - 2;

  if (payloadLength <= 0) {
    return false;
  }

  if (segment.marker === 0xDA) {
    return validateStartOfScanSegment(segment, payloadLength, buffer);
  }

  if (isStartOfFrameMarker(segment.marker)) {
    return payloadLength >= 6;
  }

  if (segment.marker === 0xC4) {
    return payloadLength >= 17;
  }

  if (segment.marker === 0xDB) {
    return payloadLength >= 65;
  }

  if (segment.marker === 0xDD) {
    return payloadLength === 2;
  }

  return true;
}

function validateStartOfScanSegment(segment: JpegSegment, payloadLength: number, buffer: Buffer): boolean {
  if (payloadLength < 6) {
    return false;
  }

  const componentCount = buffer[segment.segmentDataStart];
  const expectedMinimumPayload = 1 + (componentCount * 2) + 3;

  return componentCount > 0 && payloadLength >= expectedMinimumPayload;
}
