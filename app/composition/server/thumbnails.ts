import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ThumbnailDecryptionService } from '~/modules/thumbnail/infrastructure/decryption/thumbnail-decryption.service';
import { getThumbnailStoragePaths } from '~/modules/thumbnail/infrastructure/storage/thumbnail-storage-paths.server';

interface LoadDecryptedThumbnailResponseInput {
  eTagPrefix: string;
  notFoundMessage: string;
  request: Request;
  videoId: string;
  contentSource: string;
}

interface LoadThumbnailPreviewResponseInput {
  filename: string;
}

function createThumbnailDecryptionService() {
  return new ThumbnailDecryptionService({
    logger: console,
  });
}

export async function loadThumbnailPreviewResponse(
  input: LoadThumbnailPreviewResponseInput,
): Promise<Response> {
  const { thumbnailsDir } = getThumbnailStoragePaths();
  const thumbnailPath = join(thumbnailsDir, input.filename);

  if (!existsSync(thumbnailPath)) {
    throw new Response('Thumbnail preview not found', { status: 404 });
  }

  try {
    const stat = statSync(thumbnailPath);
    const fileSize = stat.size;
    const lastModified = stat.mtime;
    const stream = createReadStream(thumbnailPath);

    return new Response(stream as unknown as ReadableStream, {
      headers: {
        'Cache-Control': 'private, max-age=3600, must-revalidate',
        'Content-Length': fileSize.toString(),
        'Content-Type': 'image/jpeg',
        'ETag': `"preview-${input.filename}-${lastModified.getTime()}"`,
        'Last-Modified': lastModified.toUTCString(),
      },
    });
  }
  catch (error) {
    console.error('Failed to serve thumbnail preview:', error);
    throw new Response('Failed to read thumbnail preview', { status: 500 });
  }
}

export async function loadDecryptedThumbnailResponse(
  input: LoadDecryptedThumbnailResponseInput,
): Promise<Response> {
  try {
    const thumbnailDecryptionService = createThumbnailDecryptionService();
    const result = await thumbnailDecryptionService.decryptThumbnail({
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
