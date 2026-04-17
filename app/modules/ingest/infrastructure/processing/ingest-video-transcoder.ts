export interface IngestVideoTranscodeRequest {
  codecFamily?: 'h264' | 'h265';
  quality: 'high' | 'medium' | 'fast';
  sourcePath: string;
  useGpu: boolean;
  videoId: string;
  workspaceRootDir?: string;
}

export type IngestVideoTranscodeResult =
  | {
    data: {
      duration: number;
      manifestPath: string;
      thumbnailPath: string;
      videoId: string;
    };
    success: true;
  }
  | {
    error: Error;
    success: false;
  };

export interface IngestVideoTranscoder {
  transcode(request: IngestVideoTranscodeRequest): Promise<IngestVideoTranscodeResult>;
}
