import { DecryptThumbnailUseCase } from '~/modules/thumbnail/decrypt-thumbnail/decrypt-thumbnail.usecase';
import { ThumbnailEncryptionService } from '~/modules/thumbnail/shared/thumbnail-encryption.service';
import { Pbkdf2KeyManagerAdapter } from '~/modules/video/security/adapters/pbkdf2-key-manager.adapter';
import { requireAuth } from '~/utils/auth.server';

/**
 * Create dependencies for the DecryptThumbnailUseCase
 */
function createDependencies() {
  const keyManager = new Pbkdf2KeyManagerAdapter();
  const thumbnailEncryptionService = new ThumbnailEncryptionService({
    keyManager,
    logger: console,
  });

  return {
    thumbnailEncryptionService,
    logger: console,
  };
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  // Authentication check
  await requireAuth(request);

  const videoId = params.id;

  try {
    // Create UseCase with dependencies
    const dependencies = createDependencies();
    const decryptThumbnailUseCase = new DecryptThumbnailUseCase(dependencies);

    // Execute the use case
    const result = await decryptThumbnailUseCase.execute({
      videoId,
      validateAccess: true,
    });

    // Handle successful decryption
    if (result.success) {
      const { imageBuffer, mimeType, size } = result.data;

      // Generate ETag for caching
      const eTag = `"thumbnail-${videoId}-${size}"`;

      // Check if client has cached version
      const ifNoneMatch = request.headers.get('If-None-Match');
      if (ifNoneMatch === eTag) {
        return new Response(null, { status: 304 });
      }

      // Return decrypted image stream
      return new Response(imageBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Length': size.toString(),
          'Cache-Control': 'private, max-age=3600', // 1 hour cache for encrypted content
          'ETag': eTag,
          'X-Content-Source': 'decrypted-thumbnail',
        },
      });
    }
    else {
      // Handle business logic errors
      if (result.error.message.includes('not found')) {
        return new Response('Thumbnail not found', { status: 404 });
      }

      console.error('Failed to decrypt thumbnail:', result.error);
      return new Response('Failed to decrypt thumbnail', { status: 500 });
    }
  }
  catch (error) {
    // Handle unexpected errors
    console.error('Unexpected error in thumbnail decryption:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
