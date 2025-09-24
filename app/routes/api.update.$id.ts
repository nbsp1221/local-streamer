import type { ActionFunctionArgs } from 'react-router';
import type { UpdateVideoRequest } from '~/modules/video/update-video/update-video.types';
import { UpdateVideoUseCase } from '~/modules/video/update-video/update-video.usecase';
import { getVideoRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
import { createErrorResponse, handleUseCaseResult } from '~/utils/error-response.server';
export async function action({ request, params }: ActionFunctionArgs) {
  // Authentication check
  await requireAuth(request);

  if (request.method !== 'PUT' && request.method !== 'PATCH') {
    return Response.json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const videoId = params.id;
    if (!videoId) {
      return Response.json({ success: false, error: 'Video ID is required' }, { status: 400 });
    }

    // Parse request body
    const body = await request.json();

    // Create request object
    const updateRequest: UpdateVideoRequest = {
      videoId,
      title: body.title,
      tags: body.tags,
      description: body.description,
    };

    // Create UseCase with dependencies
    const useCase = new UpdateVideoUseCase({
      videoRepository: getVideoRepository(),
      logger: console,
    });

    // Execute UseCase
    const result = await useCase.execute(updateRequest);

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
    console.error('Unexpected error in update route:', error);
    return createErrorResponse(error);
  }
}
