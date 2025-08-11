import { createReadStream, statSync, existsSync } from 'fs';
import { join } from 'path';
import { findVideoById } from '~/services/video-store.server';
import { requireAuth } from '~/utils/auth.server';
import { config } from '~/configs';

/**
 * Helper function to determine MIME type from file extension
 */
function getVideoMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'ogg': return 'video/ogg';
    case 'avi': return 'video/x-msvideo';
    case 'mov': return 'video/quicktime';
    case 'mkv': return 'video/x-matroska';
    default: return 'video/mp4';
  }
}

/**
 * Helper function to find the video file path
 */
function findVideoFilePath(video: any): string {
  // Handle local video files
  if (video.videoUrl.startsWith('/data/videos/')) {
    // Extract directory ID from videoUrl: /data/videos/{ID}/video.mp4
    const urlParts = video.videoUrl.split('/');
    const directoryId = urlParts[3]; // Extract the UUID from the path
    const filename = urlParts[urlParts.length - 1]; // Extract filename
    
    const videoDir = join(config.paths.root, 'data', 'videos', directoryId);
    const filePath = join(videoDir, filename);
    
    if (existsSync(filePath)) {
      return filePath;
    }
    
    // Try the exact path from videoUrl
    const directPath = join(config.paths.root, video.videoUrl);
    if (existsSync(directPath)) {
      return directPath;
    }
  }
  
  throw new Error(`Video file not found for ID: ${video.id}, videoUrl: ${video.videoUrl}`);
}

export async function loader({ request, params }: { request: Request; params: { id: string } }) {
  // Authentication check
  await requireAuth(request);
  
  const { id } = params;
  
  // Get video information
  const video = await findVideoById(id);
  if (!video) {
    throw new Response('Video not found', { status: 404 });
  }

  // Handle external URLs
  if (!video.videoUrl.startsWith('/data/videos/')) {
    return Response.redirect(video.videoUrl);
  }

  try {
    // Find the video file path
    const filePath = findVideoFilePath(video);
    const stat = statSync(filePath);
    const fileSize = stat.size;
    
    // Determine MIME type from original video URL
    const contentType = getVideoMimeType(video.videoUrl);
    
    // Parse Range header if present
    const range = request.headers.get('range');
    
    if (range) {
      // Handle Range requests
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10) || 0;
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;
      
      // Direct file streaming with range
      const stream = createReadStream(filePath, { start, end });
      
      return new Response(stream as any, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
        },
      });
    } else {
      // Full file streaming
      const stream = createReadStream(filePath);
      
      return new Response(stream as any, {
        headers: {
          'Content-Length': fileSize.toString(),
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        },
      });
    }
  } catch (error) {
    console.error('❌ Failed to stream video:', error);
    throw new Response('File not found or streaming error', { status: 404 });
  }
}