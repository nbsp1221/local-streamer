import type { LoaderFunctionArgs } from 'react-router';
import { requireProtectedApiSession } from '~/composition/server/auth';
import { getServerIngestServices } from '~/composition/server/ingest';

export async function loader({ request }: LoaderFunctionArgs) {
  const unauthorizedResponse = await requireProtectedApiSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  const ingestServices = getServerIngestServices();
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
}
