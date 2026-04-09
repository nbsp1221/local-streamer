import path from 'node:path';

export interface StoragePaths {
  pendingJsonPath: string;
  storageDir: string;
  thumbnailsDir: string;
  uploadsDir: string;
  videosDir: string;
}

export function getStoragePaths(): StoragePaths {
  const storageDir = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');
  const uploadsDir = path.join(storageDir, 'uploads');

  return {
    pendingJsonPath: path.join(storageDir, 'data', 'pending.json'),
    storageDir,
    thumbnailsDir: path.join(uploadsDir, 'thumbnails'),
    uploadsDir,
    videosDir: path.join(storageDir, 'data', 'videos'),
  };
}
