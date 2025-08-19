import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import { config } from '~/configs';
import { findVideoById } from '~/services/video-store.server';
import { requireAuth } from '~/utils/auth.server';

// Default placeholder image path
const PLACEHOLDER_IMAGE = '/images/video-placeholder.jpg';

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  // Authentication check
  await requireAuth(request);

  const { id } = params;

  // Find video information
  const video = await findVideoById(id);
  if (!video) {
    throw new Response('Video not found', { status: 404 });
  }

  // Construct thumbnail path - try to extract directory from videoUrl first
  let thumbnailPath: string;

  if (video.videoUrl.startsWith('/data/videos/')) {
    // Extract directory ID from videoUrl: /data/videos/{ID}/video.mp4
    const urlParts = video.videoUrl.split('/');
    const directoryId = urlParts[3]; // Extract the UUID from the path
    thumbnailPath = join(config.paths.videos, directoryId, 'thumbnail.jpg');
  }
  else {
    // Fallback to using video ID
    thumbnailPath = join(config.paths.videos, id, 'thumbnail.jpg');
  }

  // Check if thumbnail exists
  if (!existsSync(thumbnailPath)) {
    // Return placeholder image or generate on-demand
    // For now, return a 404 with a message
    throw new Response('Thumbnail not found', { status: 404 });
  }

  try {
    const stat = statSync(thumbnailPath);
    const fileSize = stat.size;
    const lastModified = stat.mtime;

    // Create read stream
    const stream = createReadStream(thumbnailPath);

    // Return response with proper headers
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': fileSize.toString(),
        'Cache-Control': 'public, max-age=31536000', // 1 year cache
        'Last-Modified': lastModified.toUTCString(),
        'ETag': `"${id}-${lastModified.getTime()}"`,
      },
    });
  }
  catch (error) {
    console.error('Failed to serve thumbnail:', error);
    throw new Response('Failed to read thumbnail', { status: 500 });
  }
}
