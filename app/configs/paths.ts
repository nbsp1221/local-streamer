import path from 'path';

const ROOT_DIR = process.cwd();
const STORAGE_DIR = process.env.STORAGE_DIR ? path.resolve(process.env.STORAGE_DIR) : path.join(ROOT_DIR, 'storage');

export const paths = {
  root: ROOT_DIR,
  storage: STORAGE_DIR,
  data: path.join(STORAGE_DIR, 'data'),
  uploads: path.join(STORAGE_DIR, 'uploads'),
  videos: path.join(STORAGE_DIR, 'data', 'videos'),
  thumbnails: path.join(STORAGE_DIR, 'uploads', 'thumbnails'),

  // JSON files
  videosJson: path.join(STORAGE_DIR, 'data', 'videos.json'),
  usersJson: path.join(STORAGE_DIR, 'data', 'users.json'),
  sessionsJson: path.join(STORAGE_DIR, 'data', 'sessions.json'),
  pendingJson: path.join(STORAGE_DIR, 'data', 'pending.json'),
} as const;
