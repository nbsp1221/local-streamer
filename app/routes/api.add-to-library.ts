import type { ActionFunctionArgs } from 'react-router';
import type { AddVideoToLibraryCommand } from '~/modules/ingest/application/ports/ingest-library-intake.port';
import type { AddVideoToLibraryUseCaseResult } from '~/modules/ingest/application/use-cases/add-video-to-library.usecase';
import { requireProtectedApiSession } from '~/composition/server/auth';
import { getServerIngestServices } from '~/composition/server/ingest';
import { createErrorResponse } from '~/legacy/utils/error-response.server';

type AddToLibraryRouteServices = {
  addVideoToLibrary: {
    execute(command: AddVideoToLibraryCommand): Promise<AddVideoToLibraryUseCaseResult>;
  };
};

type AddToLibraryActionDependencies = {
  createErrorResponse: typeof createErrorResponse;
  getServerIngestServices: () => AddToLibraryRouteServices;
  requireProtectedApiSession: typeof requireProtectedApiSession;
};

export function createAddToLibraryAction(
  deps: AddToLibraryActionDependencies,
) {
  return async function action({ request }: ActionFunctionArgs) {
    const unauthorizedResponse = await deps.requireProtectedApiSession(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    try {
      const body: AddVideoToLibraryCommand = await request.json();
      const ingestServices = deps.getServerIngestServices();
      const result = await ingestServices.addVideoToLibrary.execute(body);

      if (result.ok) {
        return Response.json({
          success: true,
          ...result.data,
        });
      }

      return Response.json({
        success: false,
        error: result.message,
      }, { status: result.reason === 'ADD_TO_LIBRARY_REJECTED' ? 400 : 500 });
    }
    catch (error) {
      console.error('Unexpected error in add-to-library route:', error);
      return deps.createErrorResponse(error);
    }
  };
}

export const action = createAddToLibraryAction({
  createErrorResponse,
  getServerIngestServices,
  requireProtectedApiSession,
});
