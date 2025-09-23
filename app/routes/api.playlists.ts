import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { CreatePlaylistUseCase } from '~/modules/playlist/commands/create-playlist/create-playlist.usecase';
import { FindPlaylistsUseCase } from '~/modules/playlist/queries/find-playlists/find-playlists.usecase';
import { getPlaylistRepository, getUserRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
import { createErrorResponse, handleUseCaseResult } from '~/utils/error-response.server';

/**
 * GET /api/playlists - List playlists with filtering and pagination
 */
export async function loader({ request }: LoaderFunctionArgs) {
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

    // Parse query parameters
    const url = new URL(request.url);
    const filters = {
      type: url.searchParams.get('type') as any,
      searchQuery: url.searchParams.get('q') || undefined,
      genre: url.searchParams.getAll('genre'),
      isPublic: url.searchParams.get('isPublic') === 'true'
        ? true
        : url.searchParams.get('isPublic') === 'false' ? false : undefined,
      seriesName: url.searchParams.get('seriesName') || undefined,
      status: url.searchParams.get('status') as any,
    };

    const sortBy = (url.searchParams.get('sortBy') as any) || 'updatedAt';
    const sortOrder = (url.searchParams.get('sortOrder') as any) || 'desc';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const includeStats = url.searchParams.get('includeStats') === 'true';
    const includeEmpty = url.searchParams.get('includeEmpty') !== 'false';

    // Create use case with dependencies
    const useCase = new FindPlaylistsUseCase({
      playlistRepository: getPlaylistRepository(),
      userRepository: getUserRepository(),
      logger: console,
    });

    // Execute use case
    const result = await useCase.execute({
      userId: user?.id,
      filters,
      sortBy,
      sortOrder,
      limit,
      offset,
      includeStats,
      includeEmpty,
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
    console.error('Unexpected error in find playlists route:', error);
    return createErrorResponse(error);
  }
}

export async function action({ request }: ActionFunctionArgs) {
  // Only allow POST requests for playlist creation
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    );
  }

  try {
    // Authentication check - get authenticated user
    const user = await requireAuth(request);

    // Parse request body
    const body = await request.json();

    // Create use case with dependencies
    const useCase = new CreatePlaylistUseCase({
      playlistRepository: getPlaylistRepository(),
      userRepository: getUserRepository(),
      logger: console, // Using console as logger for now
    });

    // Execute use case with request data including user ID
    const result = await useCase.execute({ ...body, userId: user.id });

    // Handle result with type-safe error handling
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
    console.error('Unexpected error in create playlist route:', error);
    return createErrorResponse(error);
  }
}
