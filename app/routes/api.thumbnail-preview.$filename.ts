import { requireProtectedMediaSession } from '~/composition/server/auth';
import { loadThumbnailPreviewResponse } from '~/composition/server/thumbnails';

export async function loader({ request, params }: { request: Request; params: { filename: string } }) {
  const unauthorizedResponse = await requireProtectedMediaSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  return loadThumbnailPreviewResponse({
    filename: params.filename,
  });
}
