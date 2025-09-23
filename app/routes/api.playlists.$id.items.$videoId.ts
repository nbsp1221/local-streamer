import type { ActionFunctionArgs } from 'react-router';
import { RemoveVideoFromPlaylistUseCase } from '~/modules/playlist/commands/remove-video-from-playlist/remove-video-from-playlist.usecase';
import { getPlaylistRepository, getUserRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
import { createErrorResponse, handleUseCaseResult } from '~/utils/error-response.server';

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

    // Authentication required
    const user = await requireAuth(request);
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
      userId: user.id,
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
