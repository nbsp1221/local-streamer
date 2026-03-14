import type { PendingVideo } from '~/legacy/types/video';
import { getPendingVideoRepository } from '~/legacy/repositories';

export interface PendingVideosCompatReader {
  readPendingVideos(): Promise<PendingVideo[]>;
}

export function createPendingVideosCompatReader(): PendingVideosCompatReader {
  return {
    readPendingVideos: () => getPendingVideoRepository().findAll(),
  };
}
