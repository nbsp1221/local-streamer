import { type LoaderFunctionArgs } from 'react-router';
import { requireProtectedMediaSession } from '~/composition/server/auth';
import { getServerPlaybackServices } from '~/composition/server/playback';
import {
  createPlaybackDeniedResponse,
  createPlaybackUnexpectedRouteResponse,
  extractPlaybackToken,
} from './playback-route-utils';

/**
 * Handle DASH manifest (manifest.mpd)
 * RESTful endpoint: /videos/{videoId}/manifest.mpd
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId } = params;
  const unauthorizedResponse = await requireProtectedMediaSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }

  try {
    const playbackServices = getServerPlaybackServices();
    const result = await playbackServices.servePlaybackManifest.execute({
      token: extractPlaybackToken(request),
      videoId,
    });

    if (!result.ok) {
      return createPlaybackDeniedResponse(result.reason);
    }

    return new Response(result.body, {
      headers: result.headers,
    });
  }
  catch (error) {
    return createPlaybackUnexpectedRouteResponse(error, {
      fallbackMessage: 'Failed to load DASH manifest',
      fallbackStatus: 500,
    });
  }
}
