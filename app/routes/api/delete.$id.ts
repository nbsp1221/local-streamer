import type { DeleteVideoRequest } from '~/modules/video/delete-video/delete-video.types';
import { DeleteVideoUseCase } from '~/modules/video/delete-video/delete-video.usecase';
import { getVideoRepository } from '~/repositories';
import * as fileManager from '~/services/file-manager.server';
import { requireAuth } from '~/utils/auth.server';
import type { Route } from './+types/delete.$id';

export async function action({ request, params }: Route.ActionArgs) {
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
    // Create request object
    const deleteRequest: DeleteVideoRequest = {
      videoId: params.id,
    };

    // Create UseCase with dependencies
    const useCase = new DeleteVideoUseCase({
      videoRepository: getVideoRepository(),
      fileManager: {
        deleteVideoFiles: fileManager.deleteVideoFiles,
      },
      logger: console,
    });

    // Execute UseCase
    const result = await useCase.execute(deleteRequest);

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
    console.error('Unexpected error in delete route:', error);

    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred',
    }, { status: 500 });
  }
}
