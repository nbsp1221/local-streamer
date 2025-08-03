import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import { findVideoById } from '~/services/video-store.server';

// Default placeholder image path
const PLACEHOLDER_IMAGE = '/images/video-placeholder.jpg';

export async function loader({ params }: { params: { id: string } }) {
  const { id } = params;
  
  // Find video information
  const video = await findVideoById(id);
  if (!video) {
    throw new Response('Video not found', { status: 404 });
  }

  // Construct thumbnail path
  const thumbnailPath = join(process.cwd(), 'data', 'videos', id, 'thumbnail.jpg');
  
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
  } catch (error) {
    console.error('Failed to serve thumbnail:', error);
    throw new Response('Failed to read thumbnail', { status: 500 });
  }
}

// Note: In the future, XOR encryption can be added here
// The decryption logic would be applied to the stream before sending