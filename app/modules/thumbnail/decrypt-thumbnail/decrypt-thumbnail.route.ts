import { Pbkdf2KeyManagerAdapter } from '~/modules/video/security/adapters/pbkdf2-key-manager.adapter';
import { requireAuth } from '~/utils/auth.server';
import { ThumbnailEncryptionService } from '../shared/thumbnail-encryption.service';
import { DecryptThumbnailUseCase } from './decrypt-thumbnail.usecase';

interface RouteParams {
  request: Request;
  params: { id: string };
}

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

/**
 * Handle thumbnail decryption API endpoint
 * Streams decrypted thumbnail image with proper headers
 */
export async function loader({ request, params }: RouteParams) {
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
      const eTag = `"encrypted-${videoId}-${size}"`;

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
          'X-Content-Source': 'encrypted-thumbnail',
        },
      });
    }
    else {
      // Handle business logic errors
      if (result.error.message.includes('not found')) {
        return new Response('Encrypted thumbnail not found', { status: 404 });
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
