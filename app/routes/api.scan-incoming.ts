import type { LoaderFunctionArgs } from 'react-router';
import type { ScanIncomingVideosUseCaseResult } from '~/modules/ingest/application/use-cases/scan-incoming-videos.usecase';
import { requireProtectedApiSession } from '~/composition/server/auth';
import { getServerIngestServices } from '~/composition/server/ingest';

type ScanIncomingRouteServices = {
  scanIncomingVideos: {
    execute(): Promise<ScanIncomingVideosUseCaseResult>;
  };
};

type ScanIncomingLoaderDependencies = {
  getServerIngestServices: () => ScanIncomingRouteServices;
  requireProtectedApiSession: typeof requireProtectedApiSession;
};

export function createScanIncomingLoader(
  deps: ScanIncomingLoaderDependencies,
) {
  return async function loader({ request }: LoaderFunctionArgs) {
    const unauthorizedResponse = await deps.requireProtectedApiSession(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const ingestServices = deps.getServerIngestServices();
    const result = await ingestServices.scanIncomingVideos.execute();

    if (result.ok) {
      return Response.json({
        success: true,
        count: result.data.count,
        files: result.data.files,
      });
    }

    return Response.json({
      success: false,
      error: 'Failed to scan uploads files',
      files: [],
      count: 0,
    }, { status: 500 });
  };
}

export const loader = createScanIncomingLoader({
  getServerIngestServices,
  requireProtectedApiSession,
});
