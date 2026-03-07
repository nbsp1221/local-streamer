import { loadDecryptedThumbnailResponse } from '~/composition/server/thumbnails';
import { requireProtectedMediaSession } from '~/composition/server/auth';

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  const unauthorizedResponse = await requireProtectedMediaSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  return loadDecryptedThumbnailResponse({
    contentSource: 'decrypted-thumbnail',
    eTagPrefix: 'thumbnail',
    notFoundMessage: 'Thumbnail not found',
    request,
    videoId: params.id,
  });
}
