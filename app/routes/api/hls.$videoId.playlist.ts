import { validateHLSRequest, extractHLSToken } from '~/services/hls-jwt.server';
import { HLSConverter } from '~/services/hls-converter.server';

export async function loader({ request, params }: { request: Request; params: { videoId: string } }) {
  const { videoId } = params;
  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }

  // Validate JWT token
  const validation = await validateHLSRequest(request, videoId);
  if (!validation.valid) {
    console.warn(`HLS playlist access denied for ${videoId}: ${validation.error}`);
    throw new Response(validation.error || 'Unauthorized', { status: 401 });
  }
  
  try {
    const hlsConverter = new HLSConverter();
    const token = extractHLSToken(request);
    
    // Check if HLS is available for this video
    const isAvailable = await hlsConverter.isHLSAvailable(videoId);
    if (!isAvailable) {
      throw new Response('HLS not available for this video', { status: 404 });
    }
    
    // Get the playlist content
    let playlist = await hlsConverter.getPlaylist(videoId);
    
    // Modify playlist to include JWT tokens and correct paths
    if (token) {
      // Update key URL to include token
      playlist = playlist.replace(
        /URI="([^"]+)"/g,
        (match, url) => {
          if (url.startsWith('/api/hls-key/')) {
            return `URI="${url}?token=${token}"`;
          }
          return match;
        }
      );
      
      // Update segment URLs to include correct path and token
      // Change from "segment_000.ts" to "segment/segment_000.ts?token=..."
      playlist = playlist.replace(
        /^(segment_\d+\.ts)$/gm,
        `segment/$1?token=${token}`
      );
    } else {
      // Even without token, fix the path
      playlist = playlist.replace(
        /^(segment_\d+\.ts)$/gm,
        `segment/$1`
      );
    }
    
    return new Response(playlist, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    
    console.error(`Failed to serve HLS playlist for ${videoId}:`, error);
    throw new Response('Failed to load playlist', { status: 500 });
  }
}