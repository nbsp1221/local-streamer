import path from 'node:path';

export function getPlaybackStoragePaths() {
  const storageDir = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');

  return {
    storageDir,
    videosDir: path.join(storageDir, 'data', 'videos'),
  };
}
