import { createReadStream, statSync, existsSync } from 'fs';
import { join } from 'path';
import { pipeline, PassThrough } from 'stream';
import { findVideoById } from '~/services/video-store.server';
import { requireAuth } from '~/utils/auth.server';
import { getFileEncryption } from '~/services/file-encryption.server';
import { config } from '~/configs';
import { security } from '~/configs/security';

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
 * Helper function to find the actual file path (encrypted or unencrypted)
 */
function findVideoFilePath(video: any): { filePath: string; isEncrypted: boolean } {
  // First, try to use videoUrl directly if it points to local files
  if (video.videoUrl.startsWith('/data/videos/')) {
    // Extract directory ID from videoUrl: /data/videos/{ID}/video.mp4
    const urlParts = video.videoUrl.split('/');
    const directoryId = urlParts[3]; // Extract the UUID from the path
    const filename = urlParts[urlParts.length - 1]; // Extract filename
    const originalExt = filename.split('.').pop() || 'mp4';
    
    const videoDir = join(config.paths.root, 'data', 'videos', directoryId);
    
    // Try encrypted file first (new format)
    const encryptedPath = join(videoDir, `video${security.encryption.encryptedExtension}.${originalExt}`);
    if (existsSync(encryptedPath)) {
      return { filePath: encryptedPath, isEncrypted: true };
    }
    
    // Fall back to unencrypted file (legacy format)
    const unencryptedPath = join(videoDir, `video.${originalExt}`);
    if (existsSync(unencryptedPath)) {
      return { filePath: unencryptedPath, isEncrypted: false };
    }
    
    // Try the exact path from videoUrl
    const directPath = join(config.paths.root, video.videoUrl);
    if (existsSync(directPath)) {
      const isEncrypted = video.videoUrl.includes(security.encryption.encryptedExtension);
      return { filePath: directPath, isEncrypted };
    }
  }
  
  // Fallback: use video ID for directory (legacy behavior)
  const videoDir = join(config.paths.root, 'data', 'videos', video.id);
  const originalExt = video.videoUrl.split('.').pop() || 'mp4';
  
  // Try encrypted file first (new format)
  const encryptedPath = join(videoDir, `video${security.encryption.encryptedExtension}.${originalExt}`);
  if (existsSync(encryptedPath)) {
    return { filePath: encryptedPath, isEncrypted: true };
  }
  
  // Fall back to unencrypted file (legacy format)
  const unencryptedPath = join(videoDir, `video.${originalExt}`);
  if (existsSync(unencryptedPath)) {
    return { filePath: unencryptedPath, isEncrypted: false };
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
    // Find the actual file path and determine if it's encrypted
    const { filePath, isEncrypted } = findVideoFilePath(video);
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
      
      if (isEncrypted) {
        // Encrypted file: read encrypted bytes then decrypt with offset
        const encryptedStream = createReadStream(filePath, { start, end });
        const fileEncryption = getFileEncryption();
        const decryptStream = fileEncryption.createDecryptStream(start);
        
        // Create PassThrough stream for the response
        const responseStream = new PassThrough();
        
        // Pipe encrypted stream through decryption to response
        pipeline(encryptedStream, decryptStream, responseStream, (error) => {
          if (error) {
            console.error('❌ Encryption pipeline error:', error);
            responseStream.destroy(error);
          }
        });
        
        return new Response(responseStream as any, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': contentType,
            'Cache-Control': 'no-cache', // Prevent caching of encrypted content
          },
        });
      } else {
        // Unencrypted file: direct stream
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
      }
    } else {
      // Full file streaming
      if (isEncrypted) {
        // Encrypted file: full decryption stream
        const encryptedStream = createReadStream(filePath);
        const fileEncryption = getFileEncryption();
        const decryptStream = fileEncryption.createDecryptStream(0);
        
        // Create PassThrough stream for the response
        const responseStream = new PassThrough();
        
        // Pipe encrypted stream through decryption to response
        pipeline(encryptedStream, decryptStream, responseStream, (error) => {
          if (error) {
            console.error('❌ Encryption pipeline error:', error);
            responseStream.destroy(error);
          }
        });
        
        return new Response(responseStream as any, {
          headers: {
            'Content-Length': fileSize.toString(),
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache', // Prevent caching of encrypted content
          },
        });
      } else {
        // Unencrypted file: direct stream
        const stream = createReadStream(filePath);
        
        return new Response(stream as any, {
          headers: {
            'Content-Length': fileSize.toString(),
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
          },
        });
      }
    }
  } catch (error) {
    console.error('❌ Failed to stream video:', error);
    throw new Response('File not found or streaming error', { status: 404 });
  }
}