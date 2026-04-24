import type { ActionFunctionArgs } from 'react-router';
import type {
  CommitStagedUploadToLibraryCommand,
  CommitStagedUploadToLibraryUseCaseResult,
} from '~/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase';
import { requireProtectedApiSession } from '~/composition/server/auth';
import { getServerIngestServices } from '~/composition/server/ingest';

type UploadCommitRouteServices = {
  commitStagedUploadToLibrary: {
    execute(command: CommitStagedUploadToLibraryCommand): Promise<CommitStagedUploadToLibraryUseCaseResult>;
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

function createUploadCommitCommand(
  body: Record<string, unknown>,
  stagingId: string,
): CommitStagedUploadToLibraryCommand {
  const command: CommitStagedUploadToLibraryCommand = {
    genreSlugs: Array.isArray(body.genreSlugs)
      ? body.genreSlugs.filter(genreSlug => typeof genreSlug === 'string')
      : [],
    stagingId,
    tags: Array.isArray(body.tags)
      ? body.tags.filter(tag => typeof tag === 'string')
      : [],
    title: typeof body.title === 'string' ? body.title : '',
  };

  if (typeof body.contentTypeSlug === 'string') {
    command.contentTypeSlug = body.contentTypeSlug;
  }

  if (typeof body.description === 'string') {
    command.description = body.description;
  }

  if (
    body.encodingOptions &&
    typeof body.encodingOptions === 'object' &&
    'encoder' in body.encodingOptions
  ) {
    command.encodingOptions = body.encodingOptions as CommitStagedUploadToLibraryCommand['encodingOptions'];
  }

  return command;
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

      const body = await request.json();
      const input = body && typeof body === 'object'
        ? body as Record<string, unknown>
        : {};
      const result = await deps.getServerIngestServices().commitStagedUploadToLibrary.execute(
        createUploadCommitCommand(input, stagingId),
      );

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
