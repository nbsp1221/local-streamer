import path from 'path';

const ROOT_DIR = process.cwd();

export const paths = {
  root: ROOT_DIR,
  data: path.join(ROOT_DIR, 'data'),
  incoming: path.join(ROOT_DIR, 'incoming'),
  videos: path.join(ROOT_DIR, 'data', 'videos'),
  thumbnails: path.join(ROOT_DIR, 'incoming', 'thumbnails'),
  
  // JSON files
  videosJson: path.join(ROOT_DIR, 'data', 'videos.json'),
  usersJson: path.join(ROOT_DIR, 'data', 'users.json'),
  sessionsJson: path.join(ROOT_DIR, 'data', 'sessions.json'),
  pendingJson: path.join(ROOT_DIR, 'data', 'pending.json'),
} as const;