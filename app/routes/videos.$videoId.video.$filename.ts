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
 * Handle video segments (init.mp4, segment-*.m4s) from video/ folder
 * RESTful endpoint: /videos/{videoId}/video/{filename}
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId, filename } = params;

  if (!videoId || !filename) {
    throw new Response('Video ID and filename required', { status: 400 });
  }

  // Validate JWT token
  const validation = await validateHLSRequest(request, videoId);
  if (!validation.valid) {
    console.warn(`Video segment access denied for ${videoId}/video/${filename}: ${validation.error}`);
    throw new Response(validation.error || 'Unauthorized', { status: 401 });
  }

  // Validate video segment filename (init.mp4 or segment-*.m4s)
  if (!isValidDashSegmentName(filename)) {
    throw new Response('Invalid video segment name', { status: 400 });
  }

  try {
    // Construct file path: /data/videos/{videoId}/video/{filename}
    const segmentPath = join(config.paths.videos, videoId, 'video', filename);
  
    // Check if segment exists
    let fileStats;
    try {
      fileStats = await stat(segmentPath);
    }
    catch {
      throw new Response('Video segment not found', { status: 404 });
    }

    // Get proper Content-Type for DASH segment
    const contentType = getDashContentType(filename, 'video');

    // Handle range requests for better streaming performance
    const range = request.headers.get('range');
    if (range) {
      return handleDashRangeRequest(segmentPath, range, fileStats.size, contentType);
    }

    // Create read stream for the segment
    const { createReadStream } = await import('fs');
    const stream = createReadStream(segmentPath);

    console.log(`📦 Video segment served: ${videoId}/video/${filename} (${Math.round(fileStats.size / 1024)}KB)`);

    return new Response(stream as any, {
      headers: getDashSegmentHeaders(contentType, fileStats.size),
    });
  }
  catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    
    console.error(`Failed to serve video segment ${videoId}/video/${filename}:`, error);
    throw new Response('Failed to load video segment', { status: 500 });
  }
}
