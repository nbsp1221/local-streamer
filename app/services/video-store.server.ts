import type { CreateVideoInput, UpdateVideoInput } from '~/repositories/interfaces/VideoRepository';
import type { PendingVideo, Video } from '~/types/video';
import { getPendingVideoRepository, getVideoRepository } from '~/repositories';

// Get video list
export async function getVideos(): Promise<Video[]> {
  const videoRepository = getVideoRepository();
  return videoRepository.findAll();
}

// Get pending videos list
export async function getPendingVideos(): Promise<PendingVideo[]> {
  const pendingVideoRepository = getPendingVideoRepository();
  return pendingVideoRepository.findAll();
}

// Add new video
export async function addVideo(video: Video): Promise<void> {
  const videoRepository = getVideoRepository();

  // Convert Video to CreateVideoInput
  const createInput: CreateVideoInput = {
    id: video.id, // Pass the correct ID
    title: video.title,
    tags: video.tags,
    videoUrl: video.videoUrl,
    thumbnailUrl: video.thumbnailUrl,
    duration: video.duration,
    description: video.description,
  };

  await videoRepository.create(createInput);
}

// Delete video
export async function deleteVideo(videoId: string): Promise<void> {
  // Import deleteVideoFiles function
  const { deleteVideoFiles } = await import('./file-manager.server');
  const videoRepository = getVideoRepository();

  try {
    // Delete physical files first
    await deleteVideoFiles(videoId);

    // Then remove from metadata
    await videoRepository.delete(videoId);

    console.log(`✅ Video completely deleted: ${videoId}`);
  }
  catch (error) {
    console.error(`❌ Failed to delete video ${videoId}:`, error);
    throw new Error(`Failed to delete video: ${error}`);
  }
}

// Find video
export async function findVideoById(videoId: string): Promise<Video | null> {
  const videoRepository = getVideoRepository();
  return videoRepository.findById(videoId);
}

// Update video
export async function updateVideo(videoId: string, updates: Partial<Omit<Video, 'id' | 'createdAt'>>): Promise<Video | null> {
  const videoRepository = getVideoRepository();

  // Convert updates to UpdateVideoInput format
  const updateInput: UpdateVideoInput = {
    title: updates.title,
    tags: updates.tags,
    videoUrl: updates.videoUrl,
    thumbnailUrl: updates.thumbnailUrl,
    duration: updates.duration,
    description: updates.description,
  };

  return videoRepository.update(videoId, updateInput);
}
