import { type LoaderFunctionArgs } from 'react-router';
import { requireProtectedMediaSession } from '~/composition/server/auth';
import { getServerPlaybackServices } from '~/composition/server/playback';
import { getPlaybackRequestIp } from './playback-route-utils';

/**
 * Generate JWT token for video streaming access
 * RESTful endpoint: /videos/{videoId}/token
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { videoId } = params;
  const unauthorizedResponse = await requireProtectedMediaSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  if (!videoId) {
    return Response.json({ success: false, error: 'Video ID is required' }, { status: 400 });
  }

  const playbackServices = getServerPlaybackServices();
  const result = await playbackServices.issuePlaybackToken.execute({
    hasSiteSession: true,
    ipAddress: getPlaybackRequestIp(request),
    userAgent: request.headers.get('user-agent') || 'unknown',
    videoId,
  });

  if (!result.success) {
    return Response.json({
      error: 'Authentication required',
      success: false,
    }, { status: 401 });
  }

  return Response.json(result);
}
