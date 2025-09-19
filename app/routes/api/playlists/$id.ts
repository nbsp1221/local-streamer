import { DeletePlaylistUseCase } from '~/modules/playlist/commands/delete-playlist/delete-playlist.usecase';
import { UpdatePlaylistUseCase } from '~/modules/playlist/commands/update-playlist/update-playlist.usecase';
import { GetPlaylistDetailsUseCase } from '~/modules/playlist/queries/get-playlist-details/get-playlist-details.usecase';
import { getPlaylistRepository, getUserRepository, getVideoRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
import { createErrorResponse, handleUseCaseResult } from '~/utils/error-response.server';
import type { Route } from './+types/$id';

/**
 * GET /api/playlists/:id - Get playlist details
 */
export async function loader({ request, params }: Route.LoaderArgs) {
  try {
    // Authentication is optional for public playlists
    let user;
    try {
      user = await requireAuth(request);
    }
    catch {
      // Allow anonymous access for public playlists
      user = null;
    }

    const { id: playlistId } = params;
    if (!playlistId) {
      return Response.json(
        { success: false, error: 'Playlist ID is required' },
        { status: 400 },
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const includeVideos = url.searchParams.get('includeVideos') !== 'false';
    const includeStats = url.searchParams.get('includeStats') === 'true';
    const includeRelated = url.searchParams.get('includeRelated') === 'true';
    const videoLimit = parseInt(url.searchParams.get('videoLimit') || '50');
    const videoOffset = parseInt(url.searchParams.get('videoOffset') || '0');

    // Create use case with dependencies
    const useCase = new GetPlaylistDetailsUseCase({
      playlistRepository: getPlaylistRepository(),
      userRepository: getUserRepository(),
      videoRepository: getVideoRepository(),
      logger: console,
    });

    // Execute use case
    const result = await useCase.execute({
      playlistId,
      userId: user?.id,
      includeVideos,
      includeStats,
      includeRelated,
      videoLimit,
      videoOffset,
    });

    // Handle result
    const response = handleUseCaseResult(result);
    if (response instanceof Response) {
      return response;
    }

    return Response.json({
      success: true,
      ...response,
    });
  }
  catch (error) {
    console.error('Unexpected error in get playlist route:', error);
    return createErrorResponse(error);
  }
}

/**
 * PUT /api/playlists/:id - Update playlist
 * DELETE /api/playlists/:id - Delete playlist
 */
export async function action({ request, params }: Route.ActionArgs) {
  try {
    // Authentication required for all modifications
    const user = await requireAuth(request);
    const { id: playlistId } = params;

    if (!playlistId) {
      return Response.json(
        { success: false, error: 'Playlist ID is required' },
        { status: 400 },
      );
    }

    const method = request.method;

    if (method === 'PUT') {
      // Update playlist
      const body = await request.json();

      const useCase = new UpdatePlaylistUseCase({
        playlistRepository: getPlaylistRepository(),
        userRepository: getUserRepository(),
        logger: console,
      });

      const result = await useCase.execute({
        playlistId,
        userId: user.id,
        ...body,
      });

      const response = handleUseCaseResult(result);
      if (response instanceof Response) {
        return response;
      }

      return Response.json({
        success: true,
        ...response,
      });
    }
    else if (method === 'DELETE') {
      // Delete playlist
      const url = new URL(request.url);
      const force = url.searchParams.get('force') === 'true';

      const useCase = new DeletePlaylistUseCase({
        playlistRepository: getPlaylistRepository(),
        userRepository: getUserRepository(),
        logger: console,
      });

      const result = await useCase.execute({
        playlistId,
        userId: user.id,
        force,
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
    console.error('Unexpected error in playlist action route:', error);
    return createErrorResponse(error);
  }
}
