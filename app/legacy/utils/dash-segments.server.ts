import { createReadStream } from 'fs';
import path from 'path';

export type SegmentType = 'video' | 'audio';

/**
 * Determine the correct Content-Type for DASH segments based on filename and segment type
 * Following DASH Industry Forum recommendations:
 * - init.mp4: video/mp4 or audio/mp4
 * - segment-*.m4s: video/iso.segment or audio/iso.segment
 */
export function getDashContentType(filename: string, segmentType: SegmentType): string {
  const fileext = path.extname(filename).toLowerCase();

  if (fileext === '.mp4') {
    return segmentType === 'video' ? 'video/mp4' : 'audio/mp4';
  }

  if (fileext === '.m4s') {
    return segmentType === 'video' ? 'video/iso.segment' : 'audio/iso.segment';
  }

  // Fallback to mp4 for unknown formats
  return segmentType === 'video' ? 'video/mp4' : 'audio/mp4';
}

/**
 * Validate DASH segment filename
 * Allows: init.mp4, segment-0001.m4s, segment-0002.m4s, etc.
 */
export function isValidDashSegmentName(filename: string): boolean {
  // Check for path traversal patterns
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }

  // Check for null bytes (security vulnerability)
  if (filename.includes('\0')) {
    return false;
  }

  // Validate DASH segment naming: init.mp4 or segment-*.m4s
  return /^(init\.mp4|segment-\d{4}\.m4s)$/.test(filename);
}

/**
 * Handle HTTP range requests for DASH segments
 * Returns 206 Partial Content response with proper headers
 */
export function handleDashRangeRequest(
  filePath: string,
  rangeHeader: string,
  fileSize: number,
  contentType: string,
): Response {
  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

  // Validate range
  if (start >= fileSize || end >= fileSize || start > end) {
    return new Response('Range not satisfiable', {
      status: 416,
      headers: {
        'Content-Range': `bytes */${fileSize}`,
      },
    });
  }

  const chunksize = (end - start) + 1;
  const stream = createReadStream(filePath, { start, end });

  return new Response(stream as unknown as ReadableStream, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Length': chunksize.toString(),
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
    },
  });
}

/**
 * Get standard DASH segment response headers
 */
export function getDashSegmentHeaders(contentType: string, fileSize: number): HeadersInit {
  return {
    'Content-Type': contentType,
    'Content-Length': fileSize.toString(),
    'Cache-Control': 'public, max-age=31536000', // Segments are immutable
    'Accept-Ranges': 'bytes',
  };
}
