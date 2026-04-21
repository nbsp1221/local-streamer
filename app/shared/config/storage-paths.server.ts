import path from 'node:path';

export interface StoragePaths {
  stagingDir: string;
  stagingTempDir: string;
  storageDir: string;
  videosDir: string;
}

export function getStoragePaths(): StoragePaths {
  const storageDir = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');
  const stagingDir = path.join(storageDir, 'data', 'staging');

  return {
    stagingDir,
    stagingTempDir: path.join(stagingDir, 'temp'),
    storageDir,
    videosDir: path.join(storageDir, 'data', 'videos'),
  };
}
