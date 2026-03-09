import type { LoaderFunctionArgs } from 'react-router';
import type { ScanIncomingDependencies } from '~/legacy/modules/video/scan-incoming/scan-incoming.types';
import { requireProtectedApiSession } from '~/composition/server/auth';
import { DomainError } from '~/legacy/lib/errors';
import { FFmpegThumbnailAdapter } from '~/legacy/modules/thumbnail/infrastructure/adapters/ffmpeg-thumbnail.adapter';
import { ScanIncomingUseCase } from '~/legacy/modules/video/scan-incoming/scan-incoming.usecase';

// Create dependencies for the UseCase
function createDependencies(): ScanIncomingDependencies {
  return {
    thumbnailGenerator: new FFmpegThumbnailAdapter(),
    logger: console,
  };
}

export async function loader({ request }: LoaderFunctionArgs) {
  const unauthorizedResponse = await requireProtectedApiSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  // Create UseCase with dependencies
  const useCase = new ScanIncomingUseCase(createDependencies());

  // Execute UseCase
  const result = await useCase.execute({});

  // Return response based on result
  if (result.success) {
    return Response.json({
      success: true,
      ...result.data,
    });
  }
  else {
    const statusCode = result.error instanceof DomainError ? result.error.statusCode : 500;
    return Response.json({
      success: false,
      error: result.error.message,
      files: [],
      count: 0,
    }, { status: statusCode });
  }
}
