import { AddVideoToPlaylistUseCase } from '~/modules/playlist/commands/add-video-to-playlist/add-video-to-playlist.usecase';
import { ReorderPlaylistItemsUseCase } from '~/modules/playlist/commands/reorder-playlist-items/reorder-playlist-items.usecase';
import { getPlaylistRepository, getUserRepository, getVideoRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
import { createErrorResponse, handleUseCaseResult } from '~/utils/error-response.server';
import type { Route } from './+types/$id.items';

/**
 * POST /api/playlists/:id/items - Add video to playlist
 * PUT /api/playlists/:id/items - Reorder playlist items
 */
export async function action({ request, params }: Route.ActionArgs) {
  try {
    // Authentication required for all playlist modifications
    const user = await requireAuth(request);
    const { id: playlistId } = params;

    if (!playlistId) {
      return Response.json(
        { success: false, error: 'Playlist ID is required' },
        { status: 400 },
      );
    }

    const method = request.method;

    if (method === 'POST') {
      // Add video to playlist
      const body = await request.json();

      const useCase = new AddVideoToPlaylistUseCase({
        playlistRepository: getPlaylistRepository(),
        userRepository: getUserRepository(),
        videoRepository: getVideoRepository(),
        logger: console,
      });

      const result = await useCase.execute({
        playlistId,
        userId: user.id,
        videoId: body.videoId,
        position: body.position,
        episodeMetadata: body.episodeMetadata,
      });

      const response = handleUseCaseResult(result);
      if (response instanceof Response) {
        return response;
      }

      return Response.json(response);
    }
    else if (method === 'PUT') {
      // Reorder playlist items
      const body = await request.json();

      const useCase = new ReorderPlaylistItemsUseCase({
        playlistRepository: getPlaylistRepository(),
        userRepository: getUserRepository(),
        logger: console,
      });

      const result = await useCase.execute({
        playlistId,
        userId: user.id,
        newOrder: body.newOrder,
        preserveMetadata: body.preserveMetadata,
      });

      const response = handleUseCaseResult(result);
      if (response instanceof Response) {
        return response;
      }

      return Response.json(response);
    }
    else {
      return Response.json(
        { success: false, error: `Method ${method} not allowed` },
        { status: 405 },
      );
    }
  }
  catch (error) {
    console.error('Unexpected error in playlist items route:', error);
    return createErrorResponse(error);
  }
}
