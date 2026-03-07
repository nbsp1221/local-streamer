import type { ActionFunctionArgs } from 'react-router';
import { requireProtectedApiSession } from '~/composition/server/auth';
import type { UpdateVideoRequest } from '~/legacy/modules/video/update-video/update-video.types';
import { UpdateVideoUseCase } from '~/legacy/modules/video/update-video/update-video.usecase';
import { getVideoRepository } from '~/legacy/repositories';
import { createErrorResponse, handleUseCaseResult } from '~/legacy/utils/error-response.server';
export async function action({ request, params }: ActionFunctionArgs) {
  const unauthorizedResponse = await requireProtectedApiSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

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
