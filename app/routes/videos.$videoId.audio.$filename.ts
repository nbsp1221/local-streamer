import { stat } from 'fs/promises';
import { join } from 'path';
import { type LoaderFunctionArgs } from 'react-router';
import { validateHLSRequest } from '~/services/hls-jwt.server';
import { config } from '~/configs';
import {
  getDashContentType,
  isValidDashSegmentName,
  handleDashRangeRequest,
  getDashSegmentHeaders
} from '~/utils/dash-segments.server';

/**
 * Handle audio segments (init.mp4, segment-*.m4s) from audio/ folder
 * RESTful endpoint: /videos/{videoId}/audio/{filename}
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId, filename } = params;

  if (!videoId || !filename) {
    throw new Response('Video ID and filename required', { status: 400 });
  }

  // Validate JWT token
  const validation = await validateHLSRequest(request, videoId);
  if (!validation.valid) {
    console.warn(`Audio segment access denied for ${videoId}/audio/${filename}: ${validation.error}`);
    throw new Response(validation.error || 'Unauthorized', { status: 401 });
  }

  // Validate audio segment filename (init.mp4 or segment-*.m4s)
  if (!isValidDashSegmentName(filename)) {
    throw new Response('Invalid audio segment name', { status: 400 });
  }

  try {
    // Construct file path: /data/videos/{videoId}/audio/{filename}
    const segmentPath = join(config.paths.videos, videoId, 'audio', filename);
  
    // Check if segment exists
    let fileStats;
    try {
      fileStats = await stat(segmentPath);
    }
    catch {
      throw new Response('Audio segment not found', { status: 404 });
    }

    // Get proper Content-Type for DASH segment
    const contentType = getDashContentType(filename, 'audio');

    // Handle range requests for better streaming performance
    const range = request.headers.get('range');
    if (range) {
      return handleDashRangeRequest(segmentPath, range, fileStats.size, contentType);
    }

    // Create read stream for the segment
    const { createReadStream } = await import('fs');
    const stream = createReadStream(segmentPath);
    
    console.log(`🔊 Audio segment served: ${videoId}/audio/${filename} (${Math.round(fileStats.size / 1024)}KB)`);

    return new Response(stream as any, {
      headers: getDashSegmentHeaders(contentType, fileStats.size),
    });
  }
  catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    
    console.error(`Failed to serve audio segment ${videoId}/audio/${filename}:`, error);
    throw new Response('Failed to load audio segment', { status: 500 });
  }
}
