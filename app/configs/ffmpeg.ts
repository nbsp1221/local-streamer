import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Video processing binary paths configuration
 * 
 * This module provides centralized management of FFmpeg, FFprobe, and Shaka Packager binary paths.
 * It supports custom binary locations via environment variables and falls back
 * to project-local binaries downloaded via the download scripts.
 */

const ROOT_DIR = process.cwd();
const BINARIES_DIR = join(ROOT_DIR, 'binaries');

/**
 * Get the path to the FFmpeg binary
 * Priority:
 * 1. FFMPEG_PATH environment variable
 * 2. Local binary in binaries/ directory
 * 3. System ffmpeg (fallback for development)
 */
export function getFFmpegPath(): string {
  // Check environment variable first
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  // Check local binary
  const localFFmpeg = join(BINARIES_DIR, 'ffmpeg');
  if (existsSync(localFFmpeg)) {
    return localFFmpeg;
  }

  // Fallback to system ffmpeg (for development without running download script)
  // This will use the system's ffmpeg if available
  return 'ffmpeg';
}

/**
 * Get the path to the FFprobe binary
 * Priority:
 * 1. FFPROBE_PATH environment variable
 * 2. Local binary in binaries/ directory
 * 3. System ffprobe (fallback for development)
 */
export function getFFprobePath(): string {
  // Check environment variable first
  if (process.env.FFPROBE_PATH && existsSync(process.env.FFPROBE_PATH)) {
    return process.env.FFPROBE_PATH;
  }

  // Check local binary
  const localFFprobe = join(BINARIES_DIR, 'ffprobe');
  if (existsSync(localFFprobe)) {
    return localFFprobe;
  }

  // Fallback to system ffprobe (for development without running download script)
  // This will use the system's ffprobe if available
  return 'ffprobe';
}


/**
 * Get the path to the Shaka Packager binary
 * Priority:
 * 1. SHAKA_PACKAGER_PATH environment variable
 * 2. Local binary in binaries/ directory
 * 3. System packager (fallback for development)
 */
export function getShakaPackagerPath(): string {
  // Check environment variable first
  if (process.env.SHAKA_PACKAGER_PATH && existsSync(process.env.SHAKA_PACKAGER_PATH)) {
    return process.env.SHAKA_PACKAGER_PATH;
  }

  // Check local binary
  const localPackager = join(BINARIES_DIR, 'packager');
  if (existsSync(localPackager)) {
    return localPackager;
  }

  // Check Windows binary (.exe extension)
  const localPackagerExe = join(BINARIES_DIR, 'packager.exe');
  if (existsSync(localPackagerExe)) {
    return localPackagerExe;
  }

  // Fallback to system packager (for development without running download script)
  return 'packager';
}

/**
 * Log video processing tools configuration on startup
 */
export function logVideoToolsConfig(): void {
  console.log('🎬 Video Processing Tools Configuration:');
  console.log(`  FFmpeg: ${existsSync(ffmpegPath) ? '✅' : '❌'} ${ffmpegPath}`);
  console.log(`  FFprobe: ${existsSync(ffprobePath) ? '✅' : '❌'} ${ffprobePath}`);
  console.log(`  Shaka Packager: ${existsSync(shakaPackagerPath) ? '✅' : '❌'} ${shakaPackagerPath}`);

  if (!existsSync(ffmpegPath) || !existsSync(ffprobePath)) {
    console.warn('⚠️  FFmpeg binaries not found. Run "bun run download:ffmpeg" to download them.');
  }
  
  if (!existsSync(shakaPackagerPath)) {
    console.warn('⚠️  Shaka Packager binary not found. Run "bun run download:shaka" to download it.');
  }
}

/**
 * @deprecated Use logVideoToolsConfig() instead
 */
export function logFFmpegConfig(): void {
  logVideoToolsConfig();
}

// Export paths for direct use if needed
export const ffmpegPath = getFFmpegPath();
export const ffprobePath = getFFprobePath();
export const shakaPackagerPath = getShakaPackagerPath();
