import type { Route } from "./+types/add-to-library";
import { requireAuth } from "~/utils/auth.server";
import { AddVideoUseCase } from "~/modules/video/add-video/add-video.usecase";
import type { AddVideoRequest } from "~/modules/video/add-video/add-video.types";
import { getVideoRepository } from "~/repositories";
import { HLSConverter } from "~/services/hls-converter.server";
import * as fileManager from "~/services/file-manager.server";

export async function action({ request }: Route.ActionArgs) {
  // Authentication check
  await requireAuth(request);

  try {
    // Parse request body
    const body: AddVideoRequest = await request.json();

    // Create use case with dependencies
    const useCase = new AddVideoUseCase({
      videoRepository: getVideoRepository(),
      fileManager,
      hlsConverter: new HLSConverter(),
      logger: console, // Using console as logger for now
    });

    // Execute use case
    const result = await useCase.execute(body);

    // Return response based on result
    if (result.success) {
      return Response.json({
        success: true,
        ...result.data
      });
    } else {
      const statusCode = result.error instanceof Error && 'statusCode' in result.error 
        ? (result.error as any).statusCode 
        : 500;
      return Response.json({
        success: false,
        error: result.error.message
      }, { status: statusCode });
    }
    
  } catch (error) {
    console.error('Unexpected error in add-to-library route:', error);
    
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unexpected error occurred'
    }, { status: 500 });
  }
}
