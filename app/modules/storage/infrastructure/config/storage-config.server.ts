import path from 'node:path';

export interface PrimaryStorageConfig {
  databasePath: string;
  stagingDir: string;
  stagingTempDir: string;
  storageDir: string;
  videosDir: string;
}

function getStorageDir() {
  return process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');
}

export function getPrimaryStorageConfig(): PrimaryStorageConfig {
  const storageDir = getStorageDir();
  const stagingDir = path.join(storageDir, 'staging');

  return {
    databasePath: process.env.DATABASE_SQLITE_PATH
      ? path.resolve(process.env.DATABASE_SQLITE_PATH)
      : path.join(storageDir, 'db.sqlite'),
    stagingDir,
    stagingTempDir: path.join(stagingDir, 'temp'),
    storageDir,
    videosDir: path.join(storageDir, 'videos'),
  };
}
