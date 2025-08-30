import { type LoaderFunctionArgs } from 'react-router';
import { getManifestUseCase } from '~/modules/video/manifest/get-manifest.usecase';
import { validateVideoRequest } from '~/services/hls-jwt.server';

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
  const validation = await validateVideoRequest(request, videoId);
  if (!validation.valid) {
    console.warn(`DASH manifest access denied for ${videoId}: ${validation.error}`);
    throw new Response(validation.error || 'Unauthorized', { status: 401 });
  }

  try {
    // Use the new GetManifestUseCase
    const result = await getManifestUseCase.execute({ videoId });

    if (!result.success) {
      const error = result.error;
      console.error(`GetManifest UseCase failed for ${videoId}:`, error);

      // Map error types to HTTP status codes
      if (error.name === 'NotFoundError') {
        throw new Response(error.message, { status: 404 });
      }
      if (error.name === 'ValidationError') {
        throw new Response(error.message, { status: 400 });
      }
      if (error.name === 'UnauthorizedError') {
        throw new Response(error.message, { status: 401 });
      }

      // Default to 500 for internal errors
      throw new Response('Failed to load DASH manifest', { status: 500 });
    }

    const { manifestContent, headers } = result.data;

    console.log(`📽️ DASH manifest served: ${videoId}/manifest.mpd`);

    return new Response(manifestContent, {
      headers,
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
