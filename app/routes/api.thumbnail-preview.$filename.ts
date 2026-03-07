import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import { requireProtectedMediaSession } from '~/composition/server/auth';
import { config } from '~/legacy/configs';

const THUMBNAILS_DIR = config.paths.thumbnails;

export async function loader({ request, params }: { request: Request; params: { filename: string } }) {
  const unauthorizedResponse = await requireProtectedMediaSession(request);
  if (unauthorizedResponse) return unauthorizedResponse;

  const { filename } = params;

  // Construct thumbnail path
  const thumbnailPath = join(THUMBNAILS_DIR, filename);

  // Check if thumbnail exists
  if (!existsSync(thumbnailPath)) {
    throw new Response('Thumbnail preview not found', { status: 404 });
  }

  try {
    const stat = statSync(thumbnailPath);
    const fileSize = stat.size;
    const lastModified = stat.mtime;

    // Create read stream
    const stream = createReadStream(thumbnailPath);

    // Return response with proper headers
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': fileSize.toString(),
        'Cache-Control': 'private, max-age=3600, must-revalidate',
        'Last-Modified': lastModified.toUTCString(),
        'ETag': `"preview-${filename}-${lastModified.getTime()}"`,
      },
    });
  }
  catch (error) {
    console.error('Failed to serve thumbnail preview:', error);
    throw new Response('Failed to read thumbnail preview', { status: 500 });
  }
}
