import { getPrimaryStorageConfig } from '~/modules/storage/infrastructure/config/storage-config.server';

export interface StoragePaths {
  stagingDir: string;
  stagingTempDir: string;
  storageDir: string;
  videosDir: string;
}

export function getStoragePaths(): StoragePaths {
  const config = getPrimaryStorageConfig();

  return {
    stagingDir: config.stagingDir,
    stagingTempDir: config.stagingTempDir,
    storageDir: config.storageDir,
    videosDir: config.videosDir,
  };
}
