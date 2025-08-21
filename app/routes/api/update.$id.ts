import type { UpdateVideoRequest } from '~/modules/video/update-video/update-video.types';
import { UpdateVideoUseCase } from '~/modules/video/update-video/update-video.usecase';
import { getVideoRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
import type { Route } from './+types/update.$id';

export async function action({ request, params }: Route.ActionArgs) {
  // Authentication check
  await requireAuth(request);

  if (request.method !== 'PUT' && request.method !== 'PATCH') {
    return Response.json({ success: false, error: 'Method not allowed' }, { status: 405 });
  }

  try {
    // Parse request body
    const body = await request.json();

    // Create request object
    const updateRequest: UpdateVideoRequest = {
      videoId: params.id,
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

    // Return response based on result
    if (result.success) {
      return Response.json({
        success: true,
        ...result.data,
      });
    }
    else {
      const statusCode = result.error instanceof Error && 'statusCode' in result.error
        ? (result.error as any).statusCode
        : 500;
      return Response.json({
        success: false,
        error: result.error.message,
      }, { status: statusCode });
    }
  }
  catch (error) {
    console.error('Unexpected error in update route:', error);

    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred',
    }, { status: 500 });
  }
}
