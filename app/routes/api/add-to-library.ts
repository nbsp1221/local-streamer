import type { AddVideoRequest } from '~/modules/video/add-video/add-video.types';
import { AddVideoUseCase } from '~/modules/video/add-video/add-video.usecase';
import { FFprobeAnalysisService } from '~/modules/video/analysis/ffprobe-analysis.service';
import { workspaceManagerService } from '~/modules/video/storage/services/WorkspaceManagerService';
import { FFmpegVideoTranscoderAdapter } from '~/modules/video/transcoding';
import { getVideoRepository } from '~/repositories';
import { requireAuth } from '~/utils/auth.server';
import { createErrorResponse, handleUseCaseResult } from '~/utils/error-response.server';
import type { Route } from './+types/add-to-library';

export async function action({ request }: Route.ActionArgs) {
  // Authentication check
  await requireAuth(request);

  try {
    // Parse request body
    const body: AddVideoRequest = await request.json();

    // Create use case with dependencies
    const useCase = new AddVideoUseCase({
      videoRepository: getVideoRepository(),
      workspaceManager: workspaceManagerService,
      videoAnalysis: new FFprobeAnalysisService(),
      videoTranscoder: new FFmpegVideoTranscoderAdapter(),
      logger: console, // Using console as logger for now
    });

    // Execute use case
    const result = await useCase.execute(body);

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
    console.error('Unexpected error in add-to-library route:', error);
    return createErrorResponse(error);
  }
}
