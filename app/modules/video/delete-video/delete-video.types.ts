import type { VideoRepository } from '~/repositories/interfaces/VideoRepository';
import type { WorkspaceManagerService } from '../storage/types/workspace-manager.types';

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
  workspaceManager: WorkspaceManagerService;
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
  };
}
