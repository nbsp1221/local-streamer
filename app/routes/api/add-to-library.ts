import type { Route } from "./+types/add-to-library";
import { moveToLibrary, getVideoInfo, ensureVideosDirectory, moveTempThumbnailToLibrary } from "~/services/file-manager.server";
import { addVideo } from "~/services/video-store.server";
import { requireAuth } from "~/utils/auth.server";
import type { Video } from "~/types/video";
import path from "path";
import { config } from "~/configs";
import { security } from "~/configs/security";
import { HLSConverter } from "~/services/hls-converter.server";
import { getFileEncryption } from "~/services/file-encryption.server";
import { promises as fs } from 'fs';
import os from 'os';

interface AddToLibraryRequest {
  filename: string;
  title: string;
  tags: string[];
  description?: string;
}

export async function action({ request }: Route.ActionArgs) {
  // Authentication check
  await requireAuth(request);
  
  try {
    const body: AddToLibraryRequest = await request.json();
    const { filename, title, tags, description } = body;

    // Input validation
    if (!filename || !title) {
      return Response.json({
        success: false,
        error: 'Filename and title are required'
      }, { status: 400 });
    }

    // Ensure videos directory exists
    await ensureVideosDirectory();

    // Move file to library and get UUID
    const videoId = await moveToLibrary(filename);
    
    // Extract moved file information
    const ext = path.extname(filename);
    const newFilepath = `/data/videos/${videoId}/video${ext}`; // Keep original format for database
    
    // Get video info from encrypted file
    const encryptedFilename = `video${security.encryption.encryptedExtension}${ext}`;
    const encryptedVideoPath = path.join(config.paths.videos, videoId, encryptedFilename);
    const videoInfo = await getVideoInfo(encryptedVideoPath);

    // Handle thumbnail (try to move temp thumbnail first, generate if not available)
    const thumbnailPath = path.join(config.paths.videos, videoId, 'thumbnail.jpg');
    
    // Try to move temporary thumbnail first
    const tempThumbnailMoved = await moveTempThumbnailToLibrary(filename, videoId);
    
    if (!tempThumbnailMoved) {
      // No temporary thumbnail available
      // Note: Encrypted files can't be processed by FFmpeg directly
      // TODO: Implement thumbnail generation with temporary decryption if needed
      console.log(`⚠️ Skipping thumbnail generation for encrypted video: ${title} (${videoId})`);
      console.log(`   Consider generating thumbnails before encryption or implementing decryption support`);
      
      // For now, skip thumbnail generation for encrypted files
      // Future: implement temporary decryption for FFmpeg processing
    }

    // Create Video object
    const video: Video = {
      id: videoId,
      title: title.trim(),
      tags: tags.filter(tag => tag.trim().length > 0).map(tag => tag.trim()),
      thumbnailUrl: `/api/thumbnail/${videoId}`, // Use API endpoint for thumbnail
      videoUrl: newFilepath,
      duration: videoInfo.duration,
      addedAt: new Date(),
      description: description?.trim() || undefined,
      format: videoInfo.format as any // Type assertion (can be improved later)
    };

    // Save to database (XOR version)
    await addVideo(video);

    console.log(`📹 Video added to library (XOR): ${title} (${videoId})`);

    // Generate HLS version if enabled
    let hlsStatus = 'disabled';
    if (process.env.HLS_ENABLED === 'true') {
      console.log(`🎬 Starting HLS generation for ${title} (${videoId})`);
      hlsStatus = 'generating';
    }
    
    const hlsResult = await generateHLSVersion(videoId, encryptedVideoPath);
    hlsStatus = hlsResult.success ? 'completed' : 'failed';

    const responseMessage = hlsResult.success 
      ? 'Video added to library successfully (XOR + HLS)'
      : 'Video added to library with XOR only (HLS generation failed)';

    console.log(`✅ Upload completed for ${title} (${videoId}): HLS=${hlsStatus}`);

    return Response.json({
      success: true,
      videoId,
      message: responseMessage,
      formats: {
        xor: true,
        hls: hlsResult.success
      }
    });

  } catch (error) {
    console.error('Failed to add video to library:', error);
    
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add video to library'
    }, { status: 500 });
  }
}

/**
 * Generate HLS version for newly uploaded video
 * This runs after XOR encryption to create encrypted HLS streams
 */
async function generateHLSVersion(videoId: string, encryptedVideoPath: string): Promise<{success: boolean, error?: string}> {
  // Check if HLS is enabled
  if (process.env.HLS_ENABLED !== 'true') {
    console.log(`⚠️ HLS generation skipped for ${videoId}: HLS_ENABLED=false`);
    return { success: false, error: 'HLS disabled' };
  }

  console.log(`🎬 Starting HLS generation for video: ${videoId}`);
  
  let tempDecryptedPath: string | null = null;
  
  try {
    // Create temporary file for decrypted video
    tempDecryptedPath = path.join(os.tmpdir(), `local-streamer-${videoId}-${Date.now()}.mp4`);
    
    // Temporarily decrypt the XOR encrypted file
    const fileEncryption = getFileEncryption();
    await fileEncryption.decryptFile(encryptedVideoPath, tempDecryptedPath);
    
    console.log(`🔓 Temporarily decrypted ${videoId} for HLS conversion`);
    
    // Generate HLS version
    const hlsConverter = new HLSConverter();
    await hlsConverter.convertVideo(videoId, tempDecryptedPath);
    
    console.log(`✅ HLS generated successfully for ${videoId}`);
    
    // Update database with HLS status
    const { getVideoRepository } = await import('~/repositories');
    const repository = getVideoRepository();
    await repository.updateHLSStatus(videoId, true, new Date());
    
    console.log(`📝 Database updated with HLS status for ${videoId}`);
    
    return { success: true };
    
  } catch (error) {
    console.error(`❌ HLS generation failed for ${videoId}:`, error);
    
    // Update database to mark HLS as failed/unavailable
    try {
      const { getVideoRepository } = await import('~/repositories');
      const repository = getVideoRepository();
      await repository.updateHLSStatus(videoId, false);
    } catch (dbError) {
      console.error(`❌ Failed to update database HLS status for ${videoId}:`, dbError);
    }
    
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    
  } finally {
    // Clean up temporary decrypted file
    if (tempDecryptedPath) {
      try {
        await fs.unlink(tempDecryptedPath);
        console.log(`🧹 Cleaned up temporary file: ${tempDecryptedPath}`);
      } catch (cleanupError) {
        console.warn(`⚠️ Failed to clean up temporary file ${tempDecryptedPath}:`, cleanupError);
      }
    }
  }
}