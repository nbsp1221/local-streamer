export interface VideoAnalysis {
  duration: number; // in seconds
  bitrate: number; // in kbps
  audioBitrate: number; // in kbps
  audioCodec: string;
  videoCodec: string;
  fileSize: number; // in bytes

  // Enhanced metadata (Phase 3)
  width: number; // video width in pixels
  height: number; // video height in pixels
  frameRate: number; // frames per second
}

export interface BitrateCalculation {
  targetVideoBitrate: number;
  audioSettings: {
    codec: string;
    bitrate: string;
  };
}

export interface VideoAnalysisService {
  analyze(filePath: string): Promise<VideoAnalysis>;
  calculateOptimalBitrates(analysis: VideoAnalysis, encoder: string): BitrateCalculation;
}
