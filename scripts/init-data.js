#!/usr/bin/env node
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const VIDEOS_FILE = join(DATA_DIR, 'videos.json');
const PENDING_FILE = join(DATA_DIR, 'pending.json');

// 예시 데이터
const sampleVideos = [
  {
    "id": "sample-1",
    "title": "Welcome to Local Streamer",
    "tags": ["Sample", "Welcome"],
    "thumbnailUrl": "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=600&h=400&fit=crop",
    "videoUrl": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    "duration": 1800,
    "addedAt": new Date().toISOString(),
    "description": "Local Streamer에 오신 것을 환영합니다!"
  }
];

const samplePending = [];

// 데이터 디렉토리 생성
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log('✅ Created data directory');
}

// JSON 파일 초기화 (기존 파일이 없는 경우만)
if (!existsSync(VIDEOS_FILE)) {
  writeFileSync(VIDEOS_FILE, JSON.stringify(sampleVideos, null, 2));
  console.log('✅ Created videos.json with sample data');
} else {
  console.log('ℹ️  videos.json already exists, skipping');
}

if (!existsSync(PENDING_FILE)) {
  writeFileSync(PENDING_FILE, JSON.stringify(samplePending, null, 2));
  console.log('✅ Created pending.json');
} else {
  console.log('ℹ️  pending.json already exists, skipping');
}

console.log('🎉 Data initialization complete!');