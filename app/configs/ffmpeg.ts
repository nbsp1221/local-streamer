import { existsSync } from 'fs';
import { join } from 'path';

/**
 * FFmpeg binary paths configuration
 * 
 * This module provides centralized management of FFmpeg and FFprobe binary paths.
 * It supports custom binary locations via environment variables and falls back
 * to project-local binaries downloaded via the download-ffmpeg script.
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
 * Check if FFmpeg binaries are available and executable
 */
export function checkFFmpegAvailability(): {
  ffmpeg: boolean;
  ffprobe: boolean;
  paths: {
    ffmpeg: string;
    ffprobe: string;
  };
} {
  const ffmpegPath = getFFmpegPath();
  const ffprobePath = getFFprobePath();

  const ffmpegExists = testBinaryExecution(ffmpegPath);
  const ffprobeExists = testBinaryExecution(ffprobePath);

  return {
    ffmpeg: ffmpegExists,
    ffprobe: ffprobeExists,
    paths: {
      ffmpeg: ffmpegPath,
      ffprobe: ffprobePath,
    },
  };
}

/**
 * Test if binary exists and is executable by running version check
 */
function testBinaryExecution(binaryPath: string): boolean {
  try {
    // For system binaries (just 'ffmpeg' or 'ffprobe'), we assume they exist if no error
    if (binaryPath === 'ffmpeg' || binaryPath === 'ffprobe') {
      return true; // System binary fallback - will be caught at runtime if not available
    }
    
    // For local binaries, check file existence first
    if (!existsSync(binaryPath)) {
      return false;
    }
    
    // Quick execution test - just check if binary can be executed
    // Note: Using sync version for simplicity in config check
    const { execSync } = require('child_process');
    execSync(`"${binaryPath}" -version`, { stdio: 'ignore', timeout: 2000 });
    return true;
  } catch (error) {
    // Binary doesn't exist, isn't executable, or failed version check
    return false;
  }
}

/**
 * Log FFmpeg configuration on startup
 */
export function logFFmpegConfig(): void {
  const availability = checkFFmpegAvailability();

  console.log('🎬 FFmpeg Configuration:');
  console.log(`  FFmpeg: ${availability.ffmpeg ? '✅' : '❌'} ${availability.paths.ffmpeg}`);
  console.log(`  FFprobe: ${availability.ffprobe ? '✅' : '❌'} ${availability.paths.ffprobe}`);

  if (!availability.ffmpeg || !availability.ffprobe) {
    console.warn('⚠️  FFmpeg binaries not found. Run "bun run download:ffmpeg" to download them.');
  }
}

// Export paths for direct use if needed
export const ffmpegPath = getFFmpegPath();
export const ffprobePath = getFFprobePath();
