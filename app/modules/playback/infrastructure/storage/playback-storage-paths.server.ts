import { getPrimaryStorageConfig } from '~/modules/storage/infrastructure/config/storage-config.server';

export function getPlaybackStoragePaths() {
  const config = getPrimaryStorageConfig();

  return {
    storageDir: config.storageDir,
    videosDir: config.videosDir,
  };
}
