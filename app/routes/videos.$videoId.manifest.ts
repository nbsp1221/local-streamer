import { type LoaderFunctionArgs } from 'react-router';
import { validateHLSRequest } from '~/services/hls-jwt.server';
import { HLSConverter } from '~/services/hls-converter.server';

/**
 * Handle DASH manifest (manifest.mpd)
 * RESTful endpoint: /videos/{videoId}/manifest.mpd
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId } = params;

  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }

  // Validate JWT token
  const validation = await validateHLSRequest(request, videoId);
  if (!validation.valid) {
    console.warn(`DASH manifest access denied for ${videoId}: ${validation.error}`);
    throw new Response(validation.error || 'Unauthorized', { status: 401 });
  }

  try {
    const hlsConverter = new HLSConverter();

    // Check if video exists
    const isAvailable = await hlsConverter.isHLSAvailable(videoId); // TODO: Change method name for DASH
    if (!isAvailable) {
      throw new Response('Video not available', { status: 404 });
    }

    // Get DASH manifest content
    const manifest = await hlsConverter.getDashManifest(videoId);

    console.log(`📽️ DASH manifest served: ${videoId}/manifest.mpd`);

    return new Response(manifest, {
      headers: {
        'Content-Type': 'application/dash+xml',
      }
    });
  }
  catch (error) {
    if (error instanceof Response) {
      throw error;
    }

    console.error(`Failed to serve DASH manifest for ${videoId}:`, error);
    throw new Response('Failed to load DASH manifest', { status: 500 });
  }
}
