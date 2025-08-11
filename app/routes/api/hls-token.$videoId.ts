import { requireAuth } from '~/utils/auth.server';
import { generateHLSToken } from '~/services/hls-jwt.server';
import { findVideoById } from '~/services/video-store.server';

export async function loader({ request, params }: { request: Request; params: { videoId: string } }) {
  // Require regular session authentication
  const user = await requireAuth(request);
  
  const { videoId } = params;
  if (!videoId) {
    return Response.json(
      { success: false, error: 'Video ID required' },
      { status: 400 }
    );
  }

  try {
    // Verify video exists
    const video = await findVideoById(videoId);
    if (!video) {
      return Response.json(
        { success: false, error: 'Video not found' },
        { status: 404 }
      );
    }

    // Extract IP and User-Agent for token binding
    const ip = getClientIP(request);
    const userAgent = request.headers.get('User-Agent') || undefined;

    // Generate HLS access token
    const token = generateHLSToken(
      videoId,
      user.id,
      ip,
      userAgent
    );

    // Generate HLS URLs with token
    const hlsUrls = {
      playlist: `/api/hls/${videoId}/playlist.m3u8?token=${token}`,
      key: `/api/hls-key/${videoId}?token=${token}`,
      // Note: Segment URLs will be generated dynamically in the playlist
    };

    console.log(`✅ Generated HLS token for video ${videoId} (user: ${user.email})`);

    return Response.json({
      success: true,
      token,
      urls: hlsUrls,
      expiresIn: 900, // 15 minutes in seconds
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });
  } catch (error) {
    console.error(`Failed to generate HLS token for ${videoId}:`, error);
    return Response.json(
      { success: false, error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}

// Extract client IP from request headers
function getClientIP(request: Request): string | undefined {
  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('X-Real-IP');
  if (realIP) {
    return realIP;
  }
  
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) {
    return cfIP;
  }
  
  return undefined;
}