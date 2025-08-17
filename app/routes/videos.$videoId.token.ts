import { type LoaderFunctionArgs } from 'react-router';
import { generateHLSToken } from '~/services/hls-jwt.server';

/**
 * Generate JWT token for video streaming access
 * RESTful endpoint: /videos/{videoId}/token
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId } = params;
  
  if (!videoId) {
    return Response.json({ success: false, error: 'Video ID is required' }, { status: 400 });
  }

  try {
    // Extract user info from request (IP, User-Agent)
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Generate video streaming token (using 'system' as user ID for now)
    const token = generateHLSToken(videoId, 'system', ip, userAgent);
    
    console.log(`🎫 Video token generated for ${videoId} (user: system)`);

    return Response.json({
      success: true,
      token,
      urls: {
        manifest: `/videos/${videoId}/manifest.mpd?token=${token}`,
        clearkey: `/videos/${videoId}/clearkey?token=${token}`
      }
    });

  } catch (error) {
    console.error(`Failed to generate video token for ${videoId}:`, error);
    return Response.json({ 
      success: false, 
      error: 'Failed to generate video token' 
    }, { status: 500 });
  }
}