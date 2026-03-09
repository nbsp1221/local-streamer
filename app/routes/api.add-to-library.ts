import type { ActionFunctionArgs } from 'react-router';
import type { AddVideoRequest } from '~/legacy/modules/video/add-video/add-video.types';
import { requireProtectedApiSession } from '~/composition/server/auth';
import { AddVideoUseCase } from '~/legacy/modules/video/add-video/add-video.usecase';
import { FFprobeAnalysisService } from '~/legacy/modules/video/analysis/ffprobe-analysis.service';
import { workspaceManagerService } from '~/legacy/modules/video/storage/services/WorkspaceManagerService';
import { FFmpegVideoTranscoderAdapter } from '~/legacy/modules/video/transcoding';
import { getVideoRepository } from '~/legacy/repositories';
import { createErrorResponse, handleUseCaseResult } from '~/legacy/utils/error-response.server';
export async function action({ request }: ActionFunctionArgs) {
  const unauthorizedResponse = await requireProtectedApiSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

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
