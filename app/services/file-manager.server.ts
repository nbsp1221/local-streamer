import { promises as fs } from 'fs';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { PendingVideo } from '~/types/video';
import { generateSmartThumbnail } from './thumbnail-generator.server';

const INCOMING_DIR = path.join(process.cwd(), 'incoming');
const THUMBNAILS_DIR = path.join(process.cwd(), 'incoming', 'thumbnails');
const VIDEOS_DIR = path.join(process.cwd(), 'data', 'videos');

// Supported video formats
const SUPPORTED_FORMATS = ['.mp4', '.avi', '.mkv', '.mov', '.webm', '.m4v', '.flv', '.wmv'];

/**
 * Scan video files in the incoming folder and return list
 */
export async function scanIncomingFiles(): Promise<PendingVideo[]> {
  try {
    // Create incoming directory if it doesn't exist
    if (!existsSync(INCOMING_DIR)) {
      await fs.mkdir(INCOMING_DIR, { recursive: true });
      return [];
    }

    // Ensure thumbnails directory exists
    await ensureThumbnailsDirectory();

    const files = await fs.readdir(INCOMING_DIR);
    const pendingVideos: PendingVideo[] = [];

    for (const filename of files) {
      const filePath = path.join(INCOMING_DIR, filename);
      const stat = statSync(filePath);
      
      // Check if it's a file (exclude directories)
      if (!stat.isFile()) continue;
      
      // Check if it's a supported video format
      const ext = path.extname(filename).toLowerCase();
      if (!SUPPORTED_FORMATS.includes(ext)) continue;

      // Estimate MIME type
      const mimeType = getMimeType(ext);

      // Generate thumbnail if it doesn't exist
      let thumbnailUrl: string | undefined;
      const thumbnailPath = getThumbnailPreviewPath(filename);
      
      if (!existsSync(thumbnailPath)) {
        console.log(`🎬 Generating preview thumbnail for: ${filename}`);
        try {
          const result = await generateSmartThumbnail(filePath, thumbnailPath);
          if (result.success) {
            thumbnailUrl = getThumbnailPreviewUrl(filename);
            console.log(`✅ Preview thumbnail generated: ${filename}`);
          } else {
            console.log(`⚠️ Failed to generate preview thumbnail: ${filename}`, result.error);
          }
        } catch (error) {
          console.error(`❌ Error generating preview thumbnail for ${filename}:`, error);
        }
      } else {
        // Thumbnail already exists
        thumbnailUrl = getThumbnailPreviewUrl(filename);
      }

      pendingVideos.push({
        filename,
        size: stat.size,
        type: mimeType,
        path: filePath,
        thumbnailUrl
      });
    }

    // Sort by filename
    return pendingVideos.sort((a, b) => a.filename.localeCompare(b.filename));
  } catch (error) {
    console.error('Failed to scan incoming files:', error);
    return [];
  }
}

/**
 * Move file from incoming to videos directory and rename with UUID
 */
export async function moveToLibrary(filename: string): Promise<string> {
  const sourcePath = path.join(INCOMING_DIR, filename);
  
  // Check if source file exists
  if (!existsSync(sourcePath)) {
    throw new Error(`File not found: ${filename}`);
  }

  // Generate new UUID
  const videoId = uuidv4();
  const ext = path.extname(filename);
  const newFilename = `video${ext}`; // Simplified filename
  
  // Create target directory
  const targetDir = path.join(VIDEOS_DIR, videoId);
  await fs.mkdir(targetDir, { recursive: true });
  
  // Target file path
  const targetPath = path.join(targetDir, newFilename);
  
  try {
    // Move file
    await fs.rename(sourcePath, targetPath);
    console.log(`File moved successfully: ${filename} → ${targetPath}`);
    
    return videoId;
  } catch (error) {
    console.error('File move failed:', error);
    
    // Clean up created directory on failure
    try {
      await fs.rmdir(targetDir);
    } catch (cleanupError) {
      console.error('Directory cleanup failed:', cleanupError);
    }
    
    throw new Error(`File move failed: ${error}`);
  }
}

/**
 * Extract video file information (basic info only for now)
 */
export function getVideoInfo(filePath: string) {
  const stat = statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  
  return {
    size: stat.size,
    format: ext.slice(1), // Remove dot from extension
    mimeType: getMimeType(ext),
    duration: 0 // Set to 0 for now, can measure actual duration with FFprobe later
  };
}

/**
 * Return MIME type based on file extension
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.m4v': 'video/x-m4v',
    '.flv': 'video/x-flv',
    '.wmv': 'video/x-ms-wmv'
  };
  
  return mimeTypes[ext] || 'video/unknown';
}

/**
 * Check if incoming directory exists and create if not
 */
export async function ensureIncomingDirectory(): Promise<void> {
  if (!existsSync(INCOMING_DIR)) {
    await fs.mkdir(INCOMING_DIR, { recursive: true });
    console.log('Incoming directory created:', INCOMING_DIR);
  }
}

/**
 * Check if videos directory exists and create if not
 */
export async function ensureVideosDirectory(): Promise<void> {
  if (!existsSync(VIDEOS_DIR)) {
    await fs.mkdir(VIDEOS_DIR, { recursive: true });
    console.log('Videos directory created:', VIDEOS_DIR);
  }
}

/**
 * Check if thumbnails directory exists and create if not
 */
export async function ensureThumbnailsDirectory(): Promise<void> {
  if (!existsSync(THUMBNAILS_DIR)) {
    await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
    console.log('Thumbnails directory created:', THUMBNAILS_DIR);
  }
}

/**
 * Get thumbnail preview path for a given filename
 */
export function getThumbnailPreviewPath(filename: string): string {
  const nameWithoutExt = path.parse(filename).name;
  return path.join(THUMBNAILS_DIR, `${nameWithoutExt}.jpg`);
}

/**
 * Get thumbnail preview URL for a given filename
 */
export function getThumbnailPreviewUrl(filename: string): string {
  const nameWithoutExt = path.parse(filename).name;
  return `/api/thumbnail-preview/${nameWithoutExt}.jpg`;
}

/**
 * Check if temporary thumbnail exists for a video file
 */
export function tempThumbnailExists(filename: string): boolean {
  return existsSync(getThumbnailPreviewPath(filename));
}

/**
 * Move temporary thumbnail to library directory
 */
export async function moveTempThumbnailToLibrary(filename: string, videoId: string): Promise<boolean> {
  const tempThumbnailPath = getThumbnailPreviewPath(filename);
  const libraryThumbnailPath = path.join(VIDEOS_DIR, videoId, 'thumbnail.jpg');
  
  if (!existsSync(tempThumbnailPath)) {
    return false;
  }
  
  try {
    await fs.rename(tempThumbnailPath, libraryThumbnailPath);
    console.log(`✅ Moved temporary thumbnail: ${tempThumbnailPath} → ${libraryThumbnailPath}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to move temporary thumbnail:', error);
    return false;
  }
}