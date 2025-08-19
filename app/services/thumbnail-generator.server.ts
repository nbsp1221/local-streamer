import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { ffmpeg } from '~/configs';

export interface ThumbnailOptions {
  inputPath: string;
  outputPath: string;
  timestamp?: number; // seconds
}

export interface ThumbnailResult {
  success: boolean;
  error?: string;
}

/**
 * Generate thumbnail from video file
 */
export async function generateThumbnail(options: ThumbnailOptions): Promise<ThumbnailResult> {
  const { inputPath, outputPath, timestamp = 3 } = options;

  // Check if input file exists
  if (!existsSync(inputPath)) {
    return {
      success: false,
      error: `Input video file not found: ${inputPath}`,
    };
  }

  console.log(`🎬 Generating thumbnail:`);
  console.log(`   Input: ${inputPath}`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Timestamp: ${timestamp}s`);

  return new Promise((resolve) => {
    // FFmpeg arguments for thumbnail generation
    const ffmpegArgs = [
      '-ss',
      timestamp.toString(), // Seek to timestamp
      '-i',
      inputPath, // Input file
      '-vframes',
      '1', // Extract single frame
      '-vf',
      'scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2', // Scale to 640x360 with padding
      '-q:v',
      '2', // JPEG quality (2 = high quality)
      '-y', // Overwrite output file
      outputPath,
    ];

    const ffmpegProcess = spawn(ffmpeg.ffmpegPath, ffmpegArgs);

    let stderr = '';

    ffmpegProcess.stderr?.on('data', (data: any) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('close', (code: any) => {
      if (code === 0 && existsSync(outputPath)) {
        console.log(`✅ Thumbnail generated successfully: ${outputPath}`);
        resolve({
          success: true,
        });
      }
      else {
        console.error(`❌ Thumbnail generation failed (code: ${code})`);
        console.error('FFmpeg stderr:', stderr);
        resolve({
          success: false,
          error: `FFmpeg failed with code ${code}`,
        });
      }
    });

    ffmpegProcess.on('error', (err: any) => {
      console.error(`❌ FFmpeg process error: ${err.message}`);
      resolve({
        success: false,
        error: `Process error: ${err.message}`,
      });
    });
  });
}

/**
 * Try to generate thumbnail with scene detection
 * Falls back to fixed timestamp if scene detection fails
 */
export async function generateSmartThumbnail(
  inputPath: string,
  outputPath: string,
): Promise<ThumbnailResult> {
  console.log('🔍 Attempting smart thumbnail generation with scene detection...');

  // First try: Scene detection to avoid black frames
  const sceneDetectionArgs = [
    '-i',
    inputPath,
    '-vf',
    'select=\'gt(scene,0.3)\',scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2',
    '-frames:v',
    '1',
    '-vsync',
    'vfr',
    '-q:v',
    '2',
    '-y',
    outputPath,
  ];

  return new Promise((resolve) => {
    const ffmpegProcess = spawn(ffmpeg.ffmpegPath, sceneDetectionArgs);

    let stderr = '';

    ffmpegProcess.stderr?.on('data', (data: any) => {
      stderr += data.toString();
    });

    ffmpegProcess.on('close', async (code: any) => {
      if (code === 0 && existsSync(outputPath)) {
        console.log('✅ Smart thumbnail generated with scene detection');
        resolve({ success: true });
      }
      else {
        console.log('⚠️ Scene detection failed, falling back to fixed timestamp');
        // Fallback to fixed timestamp
        const result = await generateThumbnail({
          inputPath,
          outputPath,
          timestamp: 3,
        });
        resolve(result);
      }
    });

    ffmpegProcess.on('error', async (err: any) => {
      console.log('⚠️ Scene detection error, falling back to fixed timestamp');
      const result = await generateThumbnail({
        inputPath,
        outputPath,
        timestamp: 3,
      });
      resolve(result);
    });
  });
}
