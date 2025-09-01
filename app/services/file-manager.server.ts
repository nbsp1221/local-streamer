import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { existsSync, statSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { PendingVideo } from '~/types/video';
import { config, ffmpeg } from '~/configs';
import { generateSmartThumbnail } from './thumbnail-generator.server';

const UPLOADS_DIR = config.paths.uploads;
const THUMBNAILS_DIR = config.paths.thumbnails;
const VIDEOS_DIR = config.paths.videos;

// Supported video formats
const SUPPORTED_FORMATS = config.constants.supportedVideoFormats;

/**
 * Scan video files in the uploads folder and return list
 */
export async function scanIncomingFiles(): Promise<PendingVideo[]> {
  try {
    // Create uploads directory if it doesn't exist
    if (!existsSync(UPLOADS_DIR)) {
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      return [];
    }

    // Ensure thumbnails directory exists
    await ensureThumbnailsDirectory();

    const files = await fs.readdir(UPLOADS_DIR);
    const pendingVideos: PendingVideo[] = [];

    for (const filename of files) {
      const filePath = path.join(UPLOADS_DIR, filename);
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
          }
          else {
            console.log(`⚠️ Failed to generate preview thumbnail: ${filename}`, result.error);
          }
        }
        catch (error) {
          console.error(`❌ Error generating preview thumbnail for ${filename}:`, error);
        }
      }
      else {
        // Thumbnail already exists
        thumbnailUrl = getThumbnailPreviewUrl(filename);
      }

      pendingVideos.push({
        id: uuidv4(), // Generate UUID for each pending video
        filename,
        size: stat.size,
        type: mimeType,
        path: filePath,
        thumbnailUrl,
      });
    }

    // Sort by filename
    return pendingVideos.sort((a, b) => a.filename.localeCompare(b.filename));
  }
  catch (error) {
    console.error('Failed to scan uploads files:', error);
    return [];
  }
}

/**
 * Move file from uploads to videos directory and rename with UUID
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

  const sourcePath = path.join(UPLOADS_DIR, filename);

  // Check if source file exists
  if (!existsSync(sourcePath)) {
    throw new Error(`File not found: ${filename}`);
  }

  // Generate new UUID
  const videoId = uuidv4();
  const ext = path.extname(filename);
  const targetFilename = `video${ext}`;

  // Create target directory
  const targetDir = path.join(VIDEOS_DIR, videoId);
  await fs.mkdir(targetDir, { recursive: true });

  // Target file path
  const targetPath = path.join(targetDir, targetFilename);

  try {
    // Move file to target directory
    await fs.rename(sourcePath, targetPath);

    console.log(`📦 File moved successfully: ${filename} → ${targetPath}`);

    return videoId;
  }
  catch (error: any) {
    // If rename fails due to cross-device link (common in Docker), fallback to copy+delete
    if (error.code === 'EXDEV') {
      console.log('📂 Cross-device move detected, using copy+delete fallback...');
      try {
        await fs.copyFile(sourcePath, targetPath);
        await fs.unlink(sourcePath);

        console.log(`📦 File moved successfully (copy+delete): ${filename} → ${targetPath}`);

        return videoId;
      }
      catch (fallbackError) {
        console.error('❌ Fallback copy+delete failed:', fallbackError);

        // Clean up copied file if it exists
        try {
          if (existsSync(targetPath)) {
            await fs.unlink(targetPath);
          }
        }
        catch (cleanupError) {
          // Ignore cleanup errors
        }

        throw new Error(`Failed to move file from ${filename}: ${fallbackError}`);
      }
    }

    console.error('❌ File move failed:', error);

    // Clean up created directory on failure
    try {
      // Remove target file if it exists
      if (existsSync(targetPath)) {
        await fs.unlink(targetPath);
      }

      // Remove target directory if empty
      try {
        await fs.rmdir(targetDir);
      }
      catch (rmDirError) {
        // Directory might not be empty or might not exist, ignore
      }
    }
    catch (cleanupError) {
      console.error('Directory cleanup failed:', cleanupError);
    }

    throw new Error(`Failed to move file from ${filename}: ${error}`);
  }
}

/**
 * Parse duration from ffprobe JSON output
 */
function parseDurationFromJson(stdout: string): number | undefined {
  try {
    const output = JSON.parse(stdout);
    const duration = output.format?.duration || output.streams?.[0]?.duration;
    if (duration && !isNaN(parseFloat(duration))) {
      return parseFloat(duration);
    }
  }
  catch (error) {
    console.warn('Failed to parse ffprobe JSON output:', error);
  }
  return undefined;
}

/**
 * Extract video duration using ffprobe
 */
export async function extractVideoDuration(filePath: string): Promise<number> {
  if (!existsSync(filePath)) {
    console.warn(`Video file not found: ${filePath}, returning duration 0`);
    return 0;
  }

  return new Promise((resolve) => {
    // Use ffprobe to extract duration in JSON format (much more efficient)
    const ffprobeArgs = [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath,
    ];

    console.log(`🔍 Extracting duration using: ${ffmpeg.ffprobePath}`);
    const ffprobeProcess = spawn(ffmpeg.ffprobePath, ffprobeArgs);

    let stdout = '';
    let stderr = '';

    ffprobeProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    ffprobeProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffprobeProcess.on('close', (code: number | null) => {
      if (code === 0) {
        const duration = parseDurationFromJson(stdout);

        if (duration !== undefined) {
          const roundedDuration = Math.round(duration);
          console.log(`✅ Video duration extracted: ${roundedDuration}s for ${path.basename(filePath)}`);
          resolve(roundedDuration);
        }
        else {
          console.warn(`⚠️ Could not extract duration from ffprobe output for ${path.basename(filePath)}`);
          if (stderr) {
            console.warn('ffprobe stderr:', stderr.substring(0, 500));
          }
          resolve(0);
        }
      }
      else {
        console.warn(`⚠️ ffprobe exited with code ${code} for ${path.basename(filePath)}`);
        if (stderr) {
          console.warn('ffprobe stderr:', stderr.substring(0, 500));
        }
        resolve(0);
      }
    });

    ffprobeProcess.on('error', (err: Error) => {
      console.warn(`⚠️ ffprobe process error: ${err.message}, returning duration 0`);
      resolve(0);
    });
  });
}

/**
 * Extract video file information
 */
export async function getVideoInfo(filePath: string) {
  const stat = statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const duration = await extractVideoDuration(filePath);

  console.log(`📁 Processing video file: ${path.basename(filePath)}`);

  return {
    size: stat.size,
    mimeType: getMimeType(ext),
    duration,
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
    '.wmv': 'video/x-ms-wmv',
  };

  return mimeTypes[ext] || 'video/unknown';
}

/**
 * Check if uploads directory exists and create if not
 */
export async function ensureUploadsDirectory(): Promise<void> {
  if (!existsSync(UPLOADS_DIR)) {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    console.log('Uploads directory created:', UPLOADS_DIR);
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
  }
  catch (error) {
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
  }
  catch (error) {
    console.error(`❌ Failed to delete video files for ${videoId}:`, error);
    throw new Error(`Failed to delete video files: ${error}`);
  }
}
