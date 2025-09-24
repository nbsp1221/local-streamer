import type { ActionFunctionArgs } from 'react-router';
import type { DeleteVideoRequest } from '~/modules/video/delete-video/delete-video.types';
import { DeleteVideoUseCase } from '~/modules/video/delete-video/delete-video.usecase';
import { workspaceManagerService } from '~/modules/video/storage/services/WorkspaceManagerService';
import { getVideoRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
import { createErrorResponse, handleUseCaseResult } from '~/utils/error-response.server';
export async function action({ request, params }: ActionFunctionArgs) {
  // Authentication check
  await requireAuth(request);

  // Only allow DELETE method
  if (request.method !== 'DELETE') {
    return Response.json({
      success: false,
      error: 'Method not allowed',
    }, { status: 405 });
  }

  try {
    const videoId = params.id;
    if (!videoId) {
      return Response.json({
        success: false,
        error: 'Video ID is required',
      }, { status: 400 });
    }

    // Create request object
    const deleteRequest: DeleteVideoRequest = {
      videoId,
    };

    // Create UseCase with dependencies
    const useCase = new DeleteVideoUseCase({
      videoRepository: getVideoRepository(),
      workspaceManager: workspaceManagerService,
      logger: console,
    });

    // Execute UseCase
    const result = await useCase.execute(deleteRequest);

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
    console.error('Unexpected error in delete route:', error);
    return createErrorResponse(error);
  }
}
