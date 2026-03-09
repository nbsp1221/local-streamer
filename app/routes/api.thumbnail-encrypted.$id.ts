import { requireProtectedMediaSession } from '~/composition/server/auth';
import { loadDecryptedThumbnailResponse } from '~/composition/server/thumbnails';

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const unauthorizedResponse = await requireProtectedMediaSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  return loadDecryptedThumbnailResponse({
    contentSource: 'encrypted-thumbnail',
    eTagPrefix: 'encrypted',
    notFoundMessage: 'Encrypted thumbnail not found',
    request,
    videoId: params.id,
  });
}
