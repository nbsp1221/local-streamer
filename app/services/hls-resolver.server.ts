import { join, dirname } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';
import { findVideoById } from './video-store.server';

export interface HLSFileInfo {
  exists: boolean;
  playlistPath?: string;
  segmentDir?: string;
  segmentFiles?: string[];
  error?: string;
}

export async function resolveHLSFiles(videoId: string): Promise<HLSFileInfo> {
  try {
    const video = await findVideoById(videoId);
    if (!video) {
      return {
        exists: false,
        error: `Video not found: ${videoId}`
      };
    }

    // 메타데이터 우선 로직: format이 'hls'인지 확인
    if (video.format === 'hls' && video.videoUrl) {
      const playlistPath = join(process.cwd(), video.videoUrl);
      
      if (existsSync(playlistPath)) {
        const segmentDir = dirname(playlistPath);
        const segmentFiles = findSegmentFiles(segmentDir);
        
        return {
          exists: true,
          playlistPath,
          segmentDir,
          segmentFiles
        };
      }
    }

    // 파일 시스템 fallback: UUID 기반 구조에서 찾기
    const uuidPath = join(process.cwd(), 'data', 'videos', videoId);
    if (existsSync(uuidPath)) {
      const playlistPath = join(uuidPath, 'playlist.m3u8');
      
      if (existsSync(playlistPath)) {
        const segmentFiles = findSegmentFiles(uuidPath);
        
        return {
          exists: true,
          playlistPath,
          segmentDir: uuidPath,
          segmentFiles
        };
      }
    }

    return {
      exists: false,
      error: `HLS files not found: ${videoId}`
    };
    
  } catch (error) {
    return {
      exists: false,
      error: `Error resolving HLS files: ${error}`
    };
  }
}

export async function resolveSegmentFile(videoId: string, segmentFile: string): Promise<string | null> {
  const hlsInfo = await resolveHLSFiles(videoId);
  
  if (!hlsInfo.exists || !hlsInfo.segmentDir) {
    return null;
  }
  
  const sanitizedFilename = segmentFile.replace(/[^a-zA-Z0-9._-]/g, '');
  const segmentPath = join(hlsInfo.segmentDir, sanitizedFilename);
  
  if (existsSync(segmentPath) && segmentPath.endsWith('.ts')) {
    return segmentPath;
  }
  
  return null;
}

function findSegmentFiles(directory: string): string[] {
  try {
    const files = readdirSync(directory);
    
    const segmentFiles = files
      .filter(file => file.startsWith('segment') && file.endsWith('.ts'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/segment(\d+)/)?.[1] || '0');
        const bNum = parseInt(b.match(/segment(\d+)/)?.[1] || '0');
        return aNum - bNum;
      });
    
    return segmentFiles;
  } catch (error) {
    return [];
  }
}

export async function hasHLSFiles(videoId: string): Promise<boolean> {
  try {
    const video = await findVideoById(videoId);
    if (!video) {
      return false;
    }

    // 메타데이터 우선: format이 'hls'면 바로 true 반환 (성능 최적화)
    if (video.format === 'hls') {
      return true;
    }

    // format이 'hls'가 아니면 HLS 파일이 없음
    return false;
  } catch (error) {
    return false;
  }
}

export async function getHLSFilesSummary(videoId: string) {
  try {
    const video = await findVideoById(videoId);
    if (!video || video.format !== 'hls') {
      return {
        hasHLS: false,
        error: 'Video not found or not HLS format'
      };
    }

    // 메타데이터에서 직접 정보 반환 (성능 최적화)
    if (video.hlsInfo) {
      return {
        hasHLS: true,
        segmentCount: video.hlsInfo.segmentCount,
        totalSizeMB: video.hlsInfo.totalSizeMB.toString(),
        quality: video.hlsInfo.quality
      };
    }

    // hlsInfo가 없으면 파일 시스템에서 확인 (fallback)
    const info = await resolveHLSFiles(videoId);
    
    if (!info.exists) {
      return {
        hasHLS: false,
        error: info.error
      };
    }
    
    const playlistSize = info.playlistPath ? statSync(info.playlistPath).size : 0;
    const segmentCount = info.segmentFiles?.length || 0;
    
    let totalSegmentSize = 0;
    if (info.segmentFiles && info.segmentDir) {
      totalSegmentSize = info.segmentFiles.reduce((total, file) => {
        const filePath = join(info.segmentDir!, file);
        try {
          return total + statSync(filePath).size;
        } catch {
          return total;
        }
      }, 0);
    }
    
    return {
      hasHLS: true,
      playlistSize,
      segmentCount,
      totalSegmentSize,
      totalSizeMB: ((playlistSize + totalSegmentSize) / 1024 / 1024).toFixed(2)
    };
  } catch (error) {
    return {
      hasHLS: false,
      error: `Error getting HLS summary: ${error}`
    };
  }
}