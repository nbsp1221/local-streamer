import type { CreatePlaylistUseCaseRequest } from '~/modules/playlist/commands/create-playlist/create-playlist.types';
import { CreatePlaylistUseCase } from '~/modules/playlist/commands/create-playlist/create-playlist.usecase';
import { getPlaylistRepository, getUserRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
import { createErrorResponse, handleUseCaseResult } from '~/utils/error-response.server';
import type { Route } from './+types/index';

export async function action({ request }: Route.ActionArgs) {
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
