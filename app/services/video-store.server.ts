import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import type { Video, PendingVideo } from '~/types/video';
import { config } from '~/configs';

const DATA_DIR = config.paths.data;
const VIDEOS_FILE = config.paths.videosJson;
const PENDING_FILE = config.paths.pendingJson;

// 디렉토리와 파일이 존재하는지 확인하고 없으면 생성
async function ensureDataFiles() {
  try {
    // 데이터 디렉토리 생성
    if (!existsSync(DATA_DIR)) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }

    // videos.json 파일 생성
    if (!existsSync(VIDEOS_FILE)) {
      await fs.writeFile(VIDEOS_FILE, '[]', 'utf-8');
    }

    // pending.json 파일 생성
    if (!existsSync(PENDING_FILE)) {
      await fs.writeFile(PENDING_FILE, '[]', 'utf-8');
    }
  } catch (error) {
    console.error('Failed to ensure data files:', error);
    throw new Error('Failed to initialize data files');
  }
}

// 비디오 목록 조회
export async function getVideos(): Promise<Video[]> {
  try {
    await ensureDataFiles();
    const content = await fs.readFile(VIDEOS_FILE, 'utf-8');
    const videos = JSON.parse(content);
    
    // Date 객체 복원
    return videos.map((video: any) => ({
      ...video,
      addedAt: new Date(video.addedAt)
    }));
  } catch (error) {
    console.error('Failed to load videos:', error);
    return [];
  }
}

// 비디오 목록 저장
export async function saveVideos(videos: Video[]): Promise<void> {
  try {
    await ensureDataFiles();
    
    // Date 객체를 ISO 문자열로 변환
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

// 대기 중인 비디오 목록 조회
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

// 대기 중인 비디오 목록 저장
export async function savePendingVideos(pendingVideos: PendingVideo[]): Promise<void> {
  try {
    await ensureDataFiles();
    await fs.writeFile(PENDING_FILE, JSON.stringify(pendingVideos, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save pending videos:', error);
    throw new Error('Failed to save pending videos');
  }
}

// 새 비디오 추가
export async function addVideo(video: Video): Promise<void> {
  const videos = await getVideos();
  videos.unshift(video); // 최신 비디오를 맨 앞에 추가
  await saveVideos(videos);
}

// 비디오 삭제
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

// 비디오 찾기
export async function findVideoById(videoId: string): Promise<Video | null> {
  const videos = await getVideos();
  return videos.find(video => video.id === videoId) || null;
}

// 비디오 업데이트
export async function updateVideo(videoId: string, updates: Partial<Omit<Video, 'id' | 'addedAt'>>): Promise<Video | null> {
  const videos = await getVideos();
  const videoIndex = videos.findIndex(video => video.id === videoId);
  
  if (videoIndex === -1) {
    return null;
  }
  
  // 기존 비디오 정보에 업데이트 병합
  const updatedVideo = {
    ...videos[videoIndex],
    ...updates,
    id: videoId, // ID는 변경 불가
    addedAt: videos[videoIndex].addedAt // 추가 날짜는 변경 불가
  };
  
  videos[videoIndex] = updatedVideo;
  await saveVideos(videos);
  
  return updatedVideo;
}