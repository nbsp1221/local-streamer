import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { validateHLSRequest } from '~/services/hls-jwt.server';
import { HLSConverter } from '~/services/hls-converter.server';

export async function loader({ request, params }: { request: Request; params: { videoId: string; segment: string } }) {
  const { videoId, segment } = params;
  if (!videoId || !segment) {
    throw new Response('Video ID and segment required', { status: 400 });
  }

  // Validate JWT token
  const validation = await validateHLSRequest(request, videoId);
  if (!validation.valid) {
    console.warn(`HLS segment access denied for ${videoId}/${segment}: ${validation.error}`);
    throw new Response(validation.error || 'Unauthorized', { status: 401 });
  }
  
  try {
    const hlsConverter = new HLSConverter();
    
    // Security: Validate segment name to prevent path traversal attacks
    if (!hlsConverter.isValidSegmentName(segment)) {
      throw new Response('Invalid segment format', { status: 400 });
    }
    
    // Check if HLS is available for this video
    const isAvailable = await hlsConverter.isHLSAvailable(videoId);
    if (!isAvailable) {
      throw new Response('HLS not available for this video', { status: 404 });
    }
    
    // Get segment file path
    const segmentPath = hlsConverter.getSegmentPath(videoId, segment);
    
    // Check if segment exists and get file info
    let fileStats;
    try {
      fileStats = await stat(segmentPath);
    } catch {
      throw new Response('Segment not found', { status: 404 });
    }
    
    // Handle range requests (for better streaming performance)
    const range = request.headers.get('range');
    if (range) {
      return handleRangeRequest(segmentPath, range, fileStats.size);
    }
    
    // Create read stream for the segment
    const stream = createReadStream(segmentPath);
    
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'video/mp2t',
        'Content-Length': fileStats.size.toString(),
        'Cache-Control': 'public, max-age=31536000', // Segments are immutable, cache for 1 year
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Range',
      }
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    
    console.error(`Failed to serve HLS segment ${segment} for ${videoId}:`, error);
    throw new Response('Failed to load segment', { status: 500 });
  }
}

function handleRangeRequest(filePath: string, rangeHeader: string, fileSize: number): Response {
  const parts = rangeHeader.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
  
  // Validate range
  if (start >= fileSize || end >= fileSize || start > end) {
    return new Response('Range not satisfiable', { 
      status: 416,
      headers: {
        'Content-Range': `bytes */${fileSize}`
      }
    });
  }
  
  const chunksize = (end - start) + 1;
  const stream = createReadStream(filePath, { start, end });
  
  return new Response(stream as any, {
    status: 206,
    headers: {
      'Content-Type': 'video/mp2t',
      'Content-Length': chunksize.toString(),
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000',
      'Access-Control-Allow-Origin': '*',
    }
  });
}