import type { ActionFunctionArgs } from 'react-router';
import { requireProtectedApiSession, resolveLegacyCompatibilityUser } from '~/composition/server/auth';
import { RemoveVideoFromPlaylistUseCase } from '~/legacy/modules/playlist/commands/remove-video-from-playlist/remove-video-from-playlist.usecase';
import { getPlaylistRepository, getUserRepository } from '~/legacy/repositories';
import { createErrorResponse, handleUseCaseResult } from '~/legacy/utils/error-response.server';

/**
 * DELETE /api/playlists/:id/items/:videoId - Remove video from playlist
 */
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    // Only allow DELETE requests
    if (request.method !== 'DELETE') {
      return Response.json(
        { success: false, error: 'Method not allowed' },
        { status: 405 },
      );
    }

    const unauthorizedResponse = await requireProtectedApiSession(request);
    if (unauthorizedResponse) return unauthorizedResponse;
    const user = await resolveLegacyCompatibilityUser();
    const userId = user.id;
    const { id: playlistId, videoId } = params;

    if (!playlistId || !videoId) {
      return Response.json(
        { success: false, error: 'Playlist ID and video ID are required' },
        { status: 400 },
      );
    }

    // Create use case with dependencies
    const useCase = new RemoveVideoFromPlaylistUseCase({
      playlistRepository: getPlaylistRepository(),
      userRepository: getUserRepository(),
      logger: console,
    });

    // Execute use case
    const result = await useCase.execute({
      playlistId,
      userId,
      videoId,
    });

    // Handle result
    const response = handleUseCaseResult(result);
    if (response instanceof Response) {
      return response;
    }

    return Response.json(response);
  }
  catch (error) {
    console.error('Unexpected error in remove video from playlist route:', error);
    return createErrorResponse(error);
  }
}
