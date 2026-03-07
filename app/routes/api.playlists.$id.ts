import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { requireProtectedApiSession, resolveLegacyCompatibilityUser } from '~/composition/server/auth';
import { DeletePlaylistUseCase } from '~/legacy/modules/playlist/commands/delete-playlist/delete-playlist.usecase';
import { UpdatePlaylistUseCase } from '~/legacy/modules/playlist/commands/update-playlist/update-playlist.usecase';
import { GetPlaylistDetailsUseCase } from '~/legacy/modules/playlist/queries/get-playlist-details/get-playlist-details.usecase';
import { getPlaylistRepository, getUserRepository, getVideoRepository } from '~/legacy/repositories';
import { createErrorResponse, handleUseCaseResult } from '~/legacy/utils/error-response.server';

/**
 * GET /api/playlists/:id - Get playlist details
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const unauthorizedResponse = await requireProtectedApiSession(request);
    if (unauthorizedResponse) return unauthorizedResponse;
    const user = await resolveLegacyCompatibilityUser();
    const userId = user.id;

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
      userId,
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
export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const unauthorizedResponse = await requireProtectedApiSession(request);
    if (unauthorizedResponse) return unauthorizedResponse;
    const user = await resolveLegacyCompatibilityUser();
    const userId = user.id;
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
        userId,
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
        userId,
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
