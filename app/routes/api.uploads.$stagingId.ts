import type { ActionFunctionArgs } from 'react-router';
import type { RemoveStagedUploadUseCaseResult } from '~/modules/ingest/application/use-cases/remove-staged-upload.usecase';
import { requireProtectedApiSession } from '~/composition/server/auth';
import { getServerIngestServices } from '~/composition/server/ingest';

type UploadRemoveRouteServices = {
  removeStagedUpload: {
    execute(command: { stagingId: string }): Promise<RemoveStagedUploadUseCaseResult>;
  };
};

type UploadRemoveActionDependencies = {
  createErrorResponse: (error: unknown) => Response;
  getServerIngestServices: () => UploadRemoveRouteServices;
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

export function createUploadRemoveAction(
  deps: UploadRemoveActionDependencies,
) {
  return async function action({ params, request }: ActionFunctionArgs) {
    const unauthorizedResponse = await deps.requireProtectedApiSession(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    try {
      const stagingId = params.stagingId;
      if (!stagingId) {
        return Response.json({
          success: false,
          error: 'Staged upload id is required',
        }, { status: 400 });
      }

      const result = await deps.getServerIngestServices().removeStagedUpload.execute({
        stagingId,
      });

      if (result.ok) {
        return new Response(null, { status: 204 });
      }

      return Response.json({
        success: false,
        error: result.message,
      }, { status: 409 });
    }
    catch (error) {
      return deps.createErrorResponse(error);
    }
  };
}

export const action = createUploadRemoveAction({
  createErrorResponse: defaultCreateErrorResponse,
  getServerIngestServices,
  requireProtectedApiSession,
});
