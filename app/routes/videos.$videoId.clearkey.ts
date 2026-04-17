import { type ActionFunctionArgs, type LoaderFunctionArgs } from 'react-router';
import { requireProtectedMediaSession } from '~/composition/server/auth';
import { getServerPlaybackServices } from '~/composition/server/playback';
import {
  createPlaybackDeniedResponse,
  createPlaybackUnexpectedRouteResponse,
  extractPlaybackToken,
} from './playback-route-utils';

/**
 * Handle Clear Key DRM license requests
 */
async function handleClearKeyRequest(request: Request, videoId: string) {
  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }

  try {
    const playbackServices = getServerPlaybackServices();
    const result = await playbackServices.servePlaybackClearKeyLicense.execute({
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
      fallbackMessage: 'Clear Key license access denied',
      fallbackStatus: 500,
    });
  }
}

// Handle GET requests
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId } = params;
  const unauthorizedResponse = await requireProtectedMediaSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }
  return await handleClearKeyRequest(request, videoId);
}

// Handle POST requests
export async function action({ request, params }: ActionFunctionArgs) {
  const { videoId } = params;
  const unauthorizedResponse = await requireProtectedMediaSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  if (!videoId) {
    throw new Response('Video ID required', { status: 400 });
  }
  return await handleClearKeyRequest(request, videoId);
}
