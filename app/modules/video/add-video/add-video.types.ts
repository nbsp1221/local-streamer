import { type VideoRepository } from '~/repositories/interfaces/VideoRepository';
import { type VideoTranscoder } from '../transcoding';

export interface EncodingOptions {
  /** Encoder type selection - settings are automatically optimized */
  encoder: 'cpu-h265' | 'gpu-h265';
}

/**
 * Enhanced encoding options for Phase 3: Direct FFmpeg parameter control
 * Bypasses the encoder abstraction and provides explicit FFmpeg parameters
 */
export interface EnhancedEncodingOptions {
  /** FFmpeg codec name (e.g., 'libx265', 'hevc_nvenc') */
  codec: string;
  /** FFmpeg preset value (e.g., 'slow', 'p7') */
  preset: string;
  /** Quality parameter name ('crf' for CPU, 'cq' for GPU) */
  qualityParam: string;
  /** Quality parameter value (e.g., 18, 23, 28) */
  qualityValue: number;
  /** Additional FFmpeg flags for optimization */
  additionalFlags: string[];
  /** Target video bitrate in kbps */
  targetVideoBitrate: number;
  /** Audio encoding settings */
  audioSettings: {
    codec: string;
    bitrate: string;
  };
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
