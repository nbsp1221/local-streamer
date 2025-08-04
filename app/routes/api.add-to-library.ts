import type { Route } from "./+types/api.add-to-library";
import { moveToLibrary, getVideoInfo, ensureVideosDirectory, moveTempThumbnailToLibrary } from "~/services/file-manager.server";
import { addVideo } from "~/services/video-store.server";
import { generateSmartThumbnail } from "~/services/thumbnail-generator.server";
import type { Video } from "~/types/video";
import path from "path";

interface AddToLibraryRequest {
  filename: string;
  title: string;
  tags: string[];
  description?: string;
}

export async function action({ request }: Route.ActionArgs) {
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
    const newFilepath = `/data/videos/${videoId}/video${ext}`;
    const videoInfo = await getVideoInfo(path.join(process.cwd(), 'data', 'videos', videoId, `video${ext}`));

    // Handle thumbnail (try to move temp thumbnail first, generate if not available)
    const videoPath = path.join(process.cwd(), 'data', 'videos', videoId, `video${ext}`);
    const thumbnailPath = path.join(process.cwd(), 'data', 'videos', videoId, 'thumbnail.jpg');
    
    // Try to move temporary thumbnail first
    const tempThumbnailMoved = await moveTempThumbnailToLibrary(filename, videoId);
    
    if (!tempThumbnailMoved) {
      // No temporary thumbnail available, generate new one in background
      generateSmartThumbnail(videoPath, thumbnailPath)
        .then((result) => {
          if (result.success) {
            console.log(`✅ Thumbnail generated for video: ${title}`);
          } else {
            console.log(`⚠️ Failed to generate thumbnail for video: ${title}`, result.error);
          }
        })
        .catch((error) => {
          console.error(`❌ Unexpected error generating thumbnail for video: ${title}`, error);
        });
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