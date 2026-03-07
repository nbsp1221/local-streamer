import { DecryptThumbnailUseCase } from '~/legacy/modules/thumbnail/decrypt-thumbnail/decrypt-thumbnail.usecase';
import { ThumbnailEncryptionService } from '~/legacy/modules/thumbnail/shared/thumbnail-encryption.service';
import { Pbkdf2KeyManagerAdapter } from '~/legacy/modules/video/security/adapters/pbkdf2-key-manager.adapter';

interface LoadDecryptedThumbnailResponseInput {
  eTagPrefix: string;
  notFoundMessage: string;
  request: Request;
  videoId: string;
  contentSource: string;
}

function createDecryptThumbnailUseCase() {
  const keyManager = new Pbkdf2KeyManagerAdapter();
  const thumbnailEncryptionService = new ThumbnailEncryptionService({
    keyManager,
    logger: console,
  });

  return new DecryptThumbnailUseCase({
    logger: console,
    thumbnailEncryptionService,
  });
}

export async function loadDecryptedThumbnailResponse(
  input: LoadDecryptedThumbnailResponseInput,
): Promise<Response> {
  try {
    const decryptThumbnailUseCase = createDecryptThumbnailUseCase();
    const result = await decryptThumbnailUseCase.execute({
      validateAccess: true,
      videoId: input.videoId,
    });

    if (!result.success) {
      if (result.error.message.includes('not found')) {
        return new Response(input.notFoundMessage, { status: 404 });
      }

      console.error('Failed to decrypt thumbnail:', result.error);
      return new Response('Failed to decrypt thumbnail', { status: 500 });
    }

    const { imageBuffer, mimeType, size } = result.data;
    const eTag = `"${input.eTagPrefix}-${input.videoId}-${size}"`;
    const ifNoneMatch = input.request.headers.get('If-None-Match');

    if (ifNoneMatch === eTag) {
      return new Response(null, { status: 304 });
    }

    return new Response(imageBuffer, {
      headers: {
        'Cache-Control': 'private, max-age=3600',
        'Content-Length': size.toString(),
        'Content-Type': mimeType,
        'ETag': eTag,
        'X-Content-Source': input.contentSource,
      },
    });
  }
  catch (error) {
    console.error('Unexpected error in thumbnail decryption:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
