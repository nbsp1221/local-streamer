import type { ActionFunctionArgs } from 'react-router';
import type { CommitStagedUploadToLibraryUseCaseResult } from '~/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase';
import { requireProtectedApiSession } from '~/composition/server/auth';
import { getServerIngestServices } from '~/composition/server/ingest';

type UploadCommitRouteServices = {
  commitStagedUploadToLibrary: {
    execute(command: {
      description?: string;
      encodingOptions?: {
        encoder: 'cpu-h264' | 'gpu-h264' | 'cpu-h265' | 'gpu-h265';
      };
      stagingId: string;
      tags: string[];
      title: string;
    }): Promise<CommitStagedUploadToLibraryUseCaseResult>;
  };
};

type UploadCommitActionDependencies = {
  createErrorResponse: (error: unknown) => Response;
  getServerIngestServices: () => UploadCommitRouteServices;
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

export function createUploadCommitAction(
  deps: UploadCommitActionDependencies,
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

      const body = await request.json() as {
        description?: string;
        encodingOptions?: {
          encoder: 'cpu-h264' | 'gpu-h264' | 'cpu-h265' | 'gpu-h265';
        };
        tags?: string[];
        title: string;
      };
      const result = await deps.getServerIngestServices().commitStagedUploadToLibrary.execute({
        description: body.description,
        encodingOptions: body.encodingOptions,
        stagingId,
        tags: Array.isArray(body.tags) ? body.tags : [],
        title: body.title,
      });

      if (result.ok) {
        return Response.json({
          success: true,
          ...result.data,
        });
      }

      const status = result.reason === 'COMMIT_STAGED_UPLOAD_REJECTED'
        ? 400
        : result.reason === 'COMMIT_STAGED_UPLOAD_CONFLICT'
          ? 409
          : result.reason === 'COMMIT_STAGED_UPLOAD_NOT_FOUND'
            ? 404
            : 500;

      return Response.json({
        success: false,
        error: result.message,
      }, { status });
    }
    catch (error) {
      return deps.createErrorResponse(error);
    }
  };
}

export const action = createUploadCommitAction({
  createErrorResponse: defaultCreateErrorResponse,
  getServerIngestServices,
  requireProtectedApiSession,
});
