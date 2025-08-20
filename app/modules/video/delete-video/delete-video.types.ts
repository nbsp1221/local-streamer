import type { VideoRepository } from '~/repositories/interfaces/VideoRepository';

export interface DeleteVideoRequest {
  videoId: string;
}

export interface DeleteVideoResponse {
  videoId: string;
  title: string;
  message: string;
}

export interface DeleteVideoDependencies {
  videoRepository: VideoRepository;
  fileManager: {
    deleteVideoFiles: (videoId: string) => Promise<void>;
  };
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
  };
}
