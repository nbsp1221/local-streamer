import { type VideoRepository } from '~/repositories/interfaces/VideoRepository';
import { type HLSConverter } from '~/services/hls-converter.server';

export interface AddVideoRequest {
  filename: string;
  title: string;
  tags: string[];
  description?: string;
}

export interface AddVideoResponse {
  videoId: string;
  message: string;
  hlsEnabled: boolean;
}

export interface AddVideoDependencies {
  videoRepository: VideoRepository;
  fileManager: typeof import('~/services/file-manager.server');
  hlsConverter: HLSConverter;
  logger?: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
  };
}

export interface VideoInfo {
  duration: number;
  format: {
    format_name?: string;
    bit_rate?: string;
  };
}
