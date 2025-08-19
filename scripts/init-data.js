#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const VIDEOS_FILE = join(DATA_DIR, 'videos.json');
const PENDING_FILE = join(DATA_DIR, 'pending.json');

// Sample data
const sampleVideos = [
  {
    id: 'sample-1',
    title: 'Welcome to Local Streamer',
    tags: ['Sample', 'Welcome'],
    thumbnailUrl: 'https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=600&h=400&fit=crop',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    duration: 1800,
    addedAt: new Date().toISOString(),
    description: 'Welcome to Local Streamer!',
  },
];

const samplePending = [];

// Create data directory
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log('✅ Created data directory');
}

// Initialize JSON files (only if existing files don't exist)
if (!existsSync(VIDEOS_FILE)) {
  writeFileSync(VIDEOS_FILE, JSON.stringify(sampleVideos, null, 2));
  console.log('✅ Created videos.json with sample data');
}
else {
  console.log('ℹ️  videos.json already exists, skipping');
}

if (!existsSync(PENDING_FILE)) {
  writeFileSync(PENDING_FILE, JSON.stringify(samplePending, null, 2));
  console.log('✅ Created pending.json');
}
else {
  console.log('ℹ️  pending.json already exists, skipping');
}

console.log('🎉 Data initialization complete!');
