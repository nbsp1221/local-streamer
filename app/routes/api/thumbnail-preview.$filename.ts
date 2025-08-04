import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';

const THUMBNAILS_DIR = join(process.cwd(), 'incoming', 'thumbnails');

export async function loader({ params }: { params: { filename: string } }) {
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
    return new Response(stream as any, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Length': fileSize.toString(),
        'Cache-Control': 'public, max-age=3600', // 1 hour cache (shorter than library thumbnails)
        'Last-Modified': lastModified.toUTCString(),
        'ETag': `"preview-${filename}-${lastModified.getTime()}"`,
      },
    });
  } catch (error) {
    console.error('Failed to serve thumbnail preview:', error);
    throw new Response('Failed to read thumbnail preview', { status: 500 });
  }
}