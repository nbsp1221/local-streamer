import { type VideoRepository } from '~/repositories/interfaces/VideoRepository';
import { type VideoTranscoder } from '../transcoding';

export interface EncodingOptions {
  /** Encoder type selection - settings are automatically optimized */
  encoder: 'cpu-h265' | 'gpu-h265';
}

export interface AddVideoRequest {
  filename: string;
  title: string;
  tags: string[];
  description?: string;
  encodingOptions?: EncodingOptions;
}

export interface AddVideoResponse {
  videoId: string;
  message: string;
  hlsEnabled: boolean;
}

export interface AddVideoDependencies {
  videoRepository: VideoRepository;
  fileManager: typeof import('~/services/file-manager.server');
  videoTranscoder: VideoTranscoder;
  logger?: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
  };
}
