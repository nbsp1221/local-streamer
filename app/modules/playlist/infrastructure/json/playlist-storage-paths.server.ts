import path from 'node:path';

function getStorageDir() {
  return process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');
}

export function getPlaylistStoragePaths() {
  const storageDir = getStorageDir();
  const dataDir = path.join(storageDir, 'data');

  return {
    dataDir,
    playlistItemsJson: path.join(dataDir, 'playlist-items.json'),
    playlistsJson: path.join(dataDir, 'playlists.json'),
  };
}
