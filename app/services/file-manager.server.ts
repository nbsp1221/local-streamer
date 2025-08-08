import { promises as fs } from 'fs';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import ffmpegStatic from 'ffmpeg-static';
import type { PendingVideo } from '~/types/video';
import { generateSmartThumbnail } from './thumbnail-generator.server';
import { getFileEncryption } from './file-encryption.server';
import { config } from '~/configs';
import { security } from '~/configs/security';

const INCOMING_DIR = config.paths.incoming;
const THUMBNAILS_DIR = config.paths.thumbnails;
const VIDEOS_DIR = config.paths.videos;

// Supported video formats
const SUPPORTED_FORMATS = config.constants.supportedVideoFormats;

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
 * Move file from incoming to videos directory with encryption and rename with UUID
 */
export async function moveToLibrary(filename: string): Promise<string> {
  // Validate filename to prevent path traversal attacks
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename: filename must be a non-empty string');
  }
  
  // Check for path traversal sequences and directory separators
  if (filename.includes('..') || 
      filename.includes('/') || 
      filename.includes('\\') || 
      filename.includes('\0') ||
      path.isAbsolute(filename)) {
    throw new Error('Invalid filename: path traversal or absolute paths not allowed');
  }
  
  // Ensure filename doesn't start with special characters
  if (filename.startsWith('.') || filename.startsWith('-')) {
    throw new Error('Invalid filename: cannot start with . or -');
  }
  
  const sourcePath = path.join(INCOMING_DIR, filename);
  
  // Check if source file exists
  if (!existsSync(sourcePath)) {
    throw new Error(`File not found: ${filename}`);
  }

  // Generate new UUID
  const videoId = uuidv4();
  const ext = path.extname(filename);
  const encryptedFilename = `video${security.encryption.encryptedExtension}${ext}`;
  
  // Create target directory
  const targetDir = path.join(VIDEOS_DIR, videoId);
  await fs.mkdir(targetDir, { recursive: true });
  
  // Target file path (encrypted)
  const targetPath = path.join(targetDir, encryptedFilename);
  
  try {
    // Encrypt file during move
    const fileEncryption = getFileEncryption();
    await fileEncryption.encryptFile(sourcePath, targetPath);
    
    // Remove original file after successful encryption
    await fs.unlink(sourcePath);
    
    console.log(`📦 File encrypted and moved successfully: ${filename} → ${targetPath}`);
    
    return videoId;
  } catch (error) {
    console.error('❌ File encryption and move failed:', error);
    
    // Clean up created directory and any partial files on failure
    try {
      // Remove target file if it exists
      if (existsSync(targetPath)) {
        await fs.unlink(targetPath);
      }
      
      // Remove target directory if empty
      try {
        await fs.rmdir(targetDir);
      } catch (rmDirError) {
        // Directory might not be empty or might not exist, ignore
      }
    } catch (cleanupError) {
      console.error('Directory cleanup failed:', cleanupError);
    }
    
    throw new Error(`Failed to encrypt and move file from ${filename}: ${error}`);
  }
}

/**
 * Extract duration from FFmpeg stderr output
 */
function parseDurationFromStderr(stderr: string): number | undefined {
  const durationMatch = stderr.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1]);
    const minutes = parseInt(durationMatch[2]);
    const seconds = parseInt(durationMatch[3]);
    const centiseconds = parseInt(durationMatch[4]);
    
    return hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
  }
  return undefined;
}

/**
 * Extract video duration using ffmpeg
 */
export async function extractVideoDuration(filePath: string): Promise<number> {
  if (!ffmpegStatic) {
    console.warn('FFmpeg binary not found, returning duration 0');
    return 0;
  }

  if (!existsSync(filePath)) {
    console.warn(`Video file not found: ${filePath}, returning duration 0`);
    return 0;
  }

  return new Promise((resolve) => {
    // Use ffmpeg to extract duration from stderr
    const ffmpegArgs = [
      '-i', filePath,
      '-f', 'null',
      '-'
    ];

    const ffmpeg = spawn(ffmpegStatic!, ffmpegArgs);
    
    let stderr = '';

    ffmpeg.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code: number | null) => {
      const duration = parseDurationFromStderr(stderr);
      
      if (duration !== undefined) {
        const roundedDuration = Math.round(duration);
        console.log(`✅ Video duration extracted: ${roundedDuration}s for ${path.basename(filePath)}`);
        resolve(roundedDuration);
      } else {
        console.warn(`⚠️ Could not extract duration from ffmpeg output for ${path.basename(filePath)}`);
        if (stderr) {
          console.warn('FFmpeg stderr snippet:', stderr.substring(0, 500));
        }
        resolve(0);
      }
    });

    ffmpeg.on('error', (err: Error) => {
      console.warn(`⚠️ FFmpeg process error: ${err.message}, returning duration 0`);
      resolve(0);
    });
  });
}

/**
 * Extract video file information
 * Handles both encrypted and unencrypted video files
 */
export async function getVideoInfo(filePath: string) {
  const stat = statSync(filePath);
  const filename = path.basename(filePath);
  
  // Check if this is an encrypted file
  const isEncrypted = filename.includes(security.encryption.encryptedExtension);
  
  let ext: string;
  let duration: number = 0;
  
  if (isEncrypted) {
    // For encrypted files: extract original extension and skip duration extraction
    // Pattern: video.encrypted.mp4 -> .mp4
    const parts = filename.split('.');
    ext = '.' + parts[parts.length - 1]; // Get the final extension
    
    console.log(`📁 Processing encrypted video file: ${filename}, skipping duration extraction`);
    // Duration extraction skipped for encrypted files to avoid FFmpeg errors
    // TODO: Implement duration extraction with temporary decryption if needed
  } else {
    // For unencrypted files: use existing logic
    ext = path.extname(filePath).toLowerCase();
    duration = await extractVideoDuration(filePath);
  }
  
  return {
    size: stat.size,
    format: ext.slice(1), // Remove dot from extension
    mimeType: getMimeType(ext),
    duration,
    encrypted: isEncrypted
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

/**
 * Delete video files and directory completely
 */
export async function deleteVideoFiles(videoId: string): Promise<void> {
  const videoDir = path.join(VIDEOS_DIR, videoId);
  
  // Check if video directory exists
  if (!existsSync(videoDir)) {
    console.warn(`⚠️ Video directory not found: ${videoDir}`);
    return;
  }
  
  try {
    // Remove entire video directory and all its contents
    await fs.rm(videoDir, { recursive: true, force: true });
    console.log(`✅ Video files deleted successfully: ${videoId}`);
  } catch (error) {
    console.error(`❌ Failed to delete video files for ${videoId}:`, error);
    throw new Error(`Failed to delete video files: ${error}`);
  }
}