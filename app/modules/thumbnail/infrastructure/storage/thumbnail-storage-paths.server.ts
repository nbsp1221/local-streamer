import path from 'node:path';

function getStorageDir() {
  return process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');
}

export function getThumbnailStoragePaths() {
  const storageDir = getStorageDir();
  const uploadsDir = path.join(storageDir, 'uploads');

  return {
    storageDir,
    thumbnailsDir: path.join(uploadsDir, 'thumbnails'),
    uploadsDir,
    videosDir: path.join(storageDir, 'data', 'videos'),
  };
}
