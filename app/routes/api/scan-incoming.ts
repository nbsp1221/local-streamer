import type { ScanIncomingDependencies } from '~/modules/video/scan-incoming/scan-incoming.types';
import { DomainError } from '~/lib/errors';
import { FFmpegThumbnailAdapter } from '~/modules/thumbnail/infrastructure/adapters/ffmpeg-thumbnail.adapter';
import { ScanIncomingUseCase } from '~/modules/video/scan-incoming/scan-incoming.usecase';
import { requireAuth } from '~/utils/auth.server';
import type { Route } from './+types/scan-incoming';

// Create dependencies for the UseCase
function createDependencies(): ScanIncomingDependencies {
  return {
    thumbnailGenerator: new FFmpegThumbnailAdapter(),
    logger: console,
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  // Authentication check
  await requireAuth(request);

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
