import type { Route } from "./+types/add-to-library";
import { moveToLibrary, getVideoInfo, ensureVideosDirectory, moveTempThumbnailToLibrary } from "~/services/file-manager.server";
import { addVideo } from "~/services/video-store.server";
import { requireAuth } from "~/utils/auth.server";
import type { Video } from "~/types/video";
import path from "path";
import { config } from "~/configs";
import { security } from "~/configs/security";

interface AddToLibraryRequest {
  filename: string;
  title: string;
  tags: string[];
  description?: string;
}

export async function action({ request }: Route.ActionArgs) {
  // 인증 확인
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

    // Save to database
    await addVideo(video);

    console.log(`Video added to library: ${title} (${videoId})`);

    return Response.json({
      success: true,
      videoId,
      message: 'Video added to library successfully'
    });

  } catch (error) {
    console.error('Failed to add video to library:', error);
    
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add video to library'
    }, { status: 500 });
  }
}