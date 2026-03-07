import type { VideoRepository } from '~/legacy/repositories/interfaces/VideoRepository';
import type { Video } from '~/legacy/types/video';

export interface UpdateVideoRequest {
  videoId: string;
  title: string;
  tags?: string[];
  description?: string;
}

export interface UpdateVideoResponse {
  video: Video;
  message: string;
}

export interface UpdateVideoDependencies {
  videoRepository: VideoRepository;
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
  };
}
