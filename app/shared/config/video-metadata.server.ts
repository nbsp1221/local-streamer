import path from 'node:path';

interface VideoMetadataConfig {
  sqlitePath: string;
}

export function getVideoMetadataConfig(): VideoMetadataConfig {
  const storageDir = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.join(process.cwd(), 'storage');

  return {
    sqlitePath: process.env.VIDEO_METADATA_SQLITE_PATH ||
      path.join(storageDir, 'data', 'video-metadata.sqlite'),
  };
}
