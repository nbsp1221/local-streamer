import { getStoragePaths } from '~/shared/config/storage-paths.server';

export function getThumbnailStoragePaths() {
  const { storageDir, thumbnailsDir, uploadsDir, videosDir } = getStoragePaths();

  return {
    storageDir,
    thumbnailsDir,
    uploadsDir,
    videosDir,
  };
}
