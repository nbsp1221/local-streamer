/**
 * Types for FFmpeg transcoding service
 */

import type { EncodingOptions, EnhancedEncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { VideoAnalysis } from '~/modules/video/analysis/video-analysis.types';

export interface TranscodingRequest {
  /** Input file path */
  inputPath: string;
  /** Output file path */
  outputPath: string;
  /** Video ID for logging */
  videoId: string;
  /** Encoding options (legacy or enhanced) */
  encodingOptions: EncodingOptions | EnhancedEncodingOptions;
  /** Video analysis result */
  videoAnalysis: VideoAnalysis;
}

export interface TranscodingResult {
  /** Path to the transcoded file */
  outputPath: string;
  /** Duration of transcoding in milliseconds */
  duration: number;
  /** Whether GPU was used */
  usedGpu: boolean;
  /** Actual codec used */
  codec: string;
  /** File size of output */
  fileSize?: number;
}

export interface FFmpegCommandOptions {
  /** Input file path */
  input: string;
  /** Output file path */
  output: string;
  /** Video codec to use */
  videoCodec: string;
  /** Quality parameter name (crf, cq, qp, etc.) */
  qualityParam?: string;
  /** Quality value */
  qualityValue?: number;
  /** Preset (slow, medium, fast, etc.) */
  preset?: string;
  /** Video bitrate */
  videoBitrate?: string;
  /** Max video bitrate */
  maxVideoBitrate?: string;
  /** Buffer size */
  bufferSize?: string;
  /** Audio codec */
  audioCodec?: string;
  /** Audio bitrate */
  audioBitrate?: string;
  /** Audio channels */
  audioChannels?: number;
  /** Audio sample rate */
  audioSampleRate?: number;
  /** Additional flags */
  additionalFlags?: string[];
  /** Pass number for 2-pass encoding */
  passNumber?: 1 | 2;
  /** Pass log file prefix for 2-pass encoding */
  passLogPrefix?: string;
  /** Whether to use hardware acceleration */
  hwAccel?: boolean;
}

export interface FFmpegProgress {
  /** Current frame being processed */
  frame: number;
  /** Frames per second */
  fps: number;
  /** Quality value */
  quality?: number;
  /** Current size */
  size: string;
  /** Current time position */
  time: string;
  /** Bitrate */
  bitrate: string;
  /** Processing speed */
  speed: string;
  /** Progress percentage */
  percentage?: number;
}

export class TranscodingError extends Error {
  constructor(
    message: string,
    public readonly inputPath: string,
    public readonly outputPath: string,
    public readonly stderr?: string,
  ) {
    super(message);
    this.name = 'TranscodingError';
  }
}

export class CodecNotSupportedError extends TranscodingError {
  constructor(codec: string, inputPath: string, outputPath: string) {
    super(`Codec ${codec} is not supported`, inputPath, outputPath);
    this.name = 'CodecNotSupportedError';
  }
}

export interface FFmpegTranscodingService {
  /**
   * Transcode a video file with the specified options
   */
  transcode(request: TranscodingRequest): Promise<TranscodingResult>;

  /**
   * Execute two-pass encoding for better quality (GPU encoding)
   */
  transcodeTwoPass(request: TranscodingRequest): Promise<TranscodingResult>;

  /**
   * Build FFmpeg command arguments from options
   */
  buildFFmpegArgs(options: FFmpegCommandOptions): string[];

  /**
   * Check if FFmpeg is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get FFmpeg version information
   */
  getVersion(): Promise<string>;
}
