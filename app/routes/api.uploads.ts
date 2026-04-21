import type { ActionFunctionArgs } from 'react-router';
import type { StartStagedUploadUseCaseResult } from '~/modules/ingest/application/use-cases/start-staged-upload.usecase';
import { requireProtectedApiSession } from '~/composition/server/auth';
import { getServerIngestServices } from '~/composition/server/ingest';

type UploadsRouteServices = {
  startStagedUpload: {
    execute(command: {
      filename: string;
      mimeType: string;
      size: number;
      tempFilePath: string;
    }): Promise<StartStagedUploadUseCaseResult>;
  };
  uploadBrowserFile: {
    receiveSingleFileUpload(request: Request): Promise<{
      filename: string;
      mimeType: string;
      size: number;
      tempFilePath: string;
    }>;
  };
};

type UploadsActionDependencies = {
  createErrorResponse: (error: unknown) => Response;
  getServerIngestServices: () => UploadsRouteServices;
  requireProtectedApiSession: typeof requireProtectedApiSession;
};

function defaultCreateErrorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  const status = typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number'
    ? (error as { statusCode: number }).statusCode
    : 500;

  return new Response(message, { status });
}

export function createUploadsAction(
  deps: UploadsActionDependencies,
) {
  return async function action({ request }: ActionFunctionArgs) {
    const unauthorizedResponse = await deps.requireProtectedApiSession(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    try {
      const ingestServices = deps.getServerIngestServices();
      const uploadedFile = await ingestServices.uploadBrowserFile.receiveSingleFileUpload(request);
      const result = await ingestServices.startStagedUpload.execute(uploadedFile);

      if (result.ok) {
        return Response.json({
          success: true,
          ...result.data,
        });
      }

      return Response.json({
        success: false,
        error: result.message,
      }, {
        status: result.reason === 'START_STAGED_UPLOAD_REJECTED' ? 400 : 500,
      });
    }
    catch (error) {
      return deps.createErrorResponse(error);
    }
  };
}

export const action = createUploadsAction({
  createErrorResponse: defaultCreateErrorResponse,
  getServerIngestServices,
  requireProtectedApiSession,
});
