import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import type { Video, PendingVideo } from '~/types/video';
import { config } from '~/configs';

const DATA_DIR = config.paths.data;
const VIDEOS_FILE = config.paths.videosJson;
const PENDING_FILE = config.paths.pendingJson;

// Ensure directory and files exist, create if they don't
async function ensureDataFiles() {
  try {
    // Create data directory
    if (!existsSync(DATA_DIR)) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }

    // Create videos.json file
    if (!existsSync(VIDEOS_FILE)) {
      await fs.writeFile(VIDEOS_FILE, '[]', 'utf-8');
    }

    // Create pending.json file
    if (!existsSync(PENDING_FILE)) {
      await fs.writeFile(PENDING_FILE, '[]', 'utf-8');
    }
  } catch (error) {
    console.error('Failed to ensure data files:', error);
    throw new Error('Failed to initialize data files');
  }
}

// Get video list
export async function getVideos(): Promise<Video[]> {
  try {
    await ensureDataFiles();
    const content = await fs.readFile(VIDEOS_FILE, 'utf-8');
    const videos = JSON.parse(content);
    
    // Restore Date objects
    return videos.map((video: any) => ({
      ...video,
      addedAt: new Date(video.addedAt)
    }));
  } catch (error) {
    console.error('Failed to load videos:', error);
    return [];
  }
}

// Save video list
export async function saveVideos(videos: Video[]): Promise<void> {
  try {
    await ensureDataFiles();
    
    // Convert Date objects to ISO strings
    const serializedVideos = videos.map(video => ({
      ...video,
      addedAt: video.addedAt.toISOString()
    }));
    
    await fs.writeFile(VIDEOS_FILE, JSON.stringify(serializedVideos, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save videos:', error);
    throw new Error('Failed to save videos');
  }
}

// Get pending videos list
export async function getPendingVideos(): Promise<PendingVideo[]> {
  try {
    await ensureDataFiles();
    const content = await fs.readFile(PENDING_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load pending videos:', error);
    return [];
  }
}

// Save pending videos list
export async function savePendingVideos(pendingVideos: PendingVideo[]): Promise<void> {
  try {
    await ensureDataFiles();
    await fs.writeFile(PENDING_FILE, JSON.stringify(pendingVideos, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save pending videos:', error);
    throw new Error('Failed to save pending videos');
  }
}

// Add new video
export async function addVideo(video: Video): Promise<void> {
  const videos = await getVideos();
  videos.unshift(video); // Add newest video to the front
  await saveVideos(videos);
}

// Delete video
export async function deleteVideo(videoId: string): Promise<void> {
  // Import deleteVideoFiles function
  const { deleteVideoFiles } = await import('./file-manager.server');
  
  try {
    // Delete physical files first
    await deleteVideoFiles(videoId);
    
    // Then remove from metadata
    const videos = await getVideos();
    const filteredVideos = videos.filter(video => video.id !== videoId);
    await saveVideos(filteredVideos);
    
    console.log(`✅ Video completely deleted: ${videoId}`);
  } catch (error) {
    console.error(`❌ Failed to delete video ${videoId}:`, error);
    throw new Error(`Failed to delete video: ${error}`);
  }
}

// Find video
export async function findVideoById(videoId: string): Promise<Video | null> {
  const videos = await getVideos();
  return videos.find(video => video.id === videoId) || null;
}

// Update video
export async function updateVideo(videoId: string, updates: Partial<Omit<Video, 'id' | 'addedAt'>>): Promise<Video | null> {
  const videos = await getVideos();
  const videoIndex = videos.findIndex(video => video.id === videoId);
  
  if (videoIndex === -1) {
    return null;
  }
  
  // Merge updates with existing video info
  const updatedVideo = {
    ...videos[videoIndex],
    ...updates,
    id: videoId, // ID cannot be changed
    addedAt: videos[videoIndex].addedAt // Added date cannot be changed
  };
  
  videos[videoIndex] = updatedVideo;
  await saveVideos(videos);
  
  return updatedVideo;
}