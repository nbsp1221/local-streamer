import type { Route } from "./+types/add-to-library";
import { moveToLibrary, getVideoInfo, ensureVideosDirectory, moveTempThumbnailToLibrary } from "~/services/file-manager.server";
import { addVideo } from "~/services/video-store.server";
import { requireAuth } from "~/utils/auth.server";
import type { Video } from "~/types/video";
import path from "path";
import { config } from "~/configs";
import { HLSConverter } from "~/services/hls-converter.server";
import { promises as fs } from 'fs';

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
    const videoPath = path.join(config.paths.videos, videoId, `video${ext}`);
    
    // Get video info from the moved file (before HLS conversion)
    const videoInfo = await getVideoInfo(videoPath);

    // Handle thumbnail (try to move temp thumbnail first, generate if not available)
    const thumbnailPath = path.join(config.paths.videos, videoId, 'thumbnail.jpg');
    
    // Try to move temporary thumbnail first
    const tempThumbnailMoved = await moveTempThumbnailToLibrary(filename, videoId);
    
    if (!tempThumbnailMoved) {
      console.log(`ℹ️ No temporary thumbnail available for: ${title} (${videoId})`);
      console.log(`   Thumbnail will be generated during HLS conversion if needed`);
    }

    // Create Video object - videoUrl points to HLS stream (original will be deleted)
    const video: Video = {
      id: videoId,
      title: title.trim(),
      tags: tags.filter(tag => tag.trim().length > 0).map(tag => tag.trim()),
      thumbnailUrl: `/api/thumbnail/${videoId}`, // Use API endpoint for thumbnail
      videoUrl: `/data/videos/${videoId}/playlist.m3u8`, // Point to HLS playlist
      duration: videoInfo.duration,
      addedAt: new Date(),
      description: description?.trim() || undefined,
      format: videoInfo.format as any // Type assertion (can be improved later)
    };

    // Save to database
    await addVideo(video);

    console.log(`📹 Video added to library: ${title} (${videoId})`);

    // Generate HLS version
    let hlsStatus = 'generating';
    const hlsResult = await generateHLSVersion(videoId, videoPath);
    hlsStatus = hlsResult.success ? 'completed' : 'failed';

    const responseMessage = hlsResult.success 
      ? 'Video added to library successfully with HLS'
      : 'Video added to library but HLS generation failed';

    console.log(`✅ Upload completed for ${title} (${videoId}): HLS=${hlsStatus}`);

    return Response.json({
      success: true,
      videoId,
      message: responseMessage,
      hlsEnabled: hlsResult.success
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
 * Direct conversion from original file to HLS
 */
async function generateHLSVersion(videoId: string, videoPath: string): Promise<{success: boolean, error?: string}> {
  console.log(`🎬 Starting HLS generation for video: ${videoId}`);
  
  try {
    // Generate HLS version directly from original file
    const hlsConverter = new HLSConverter();
    await hlsConverter.convertVideo(videoId, videoPath);
    
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
  }
}