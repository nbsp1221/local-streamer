export interface VideoAnalysis {
  duration: number; // in seconds
  bitrate: number; // in kbps
  audioBitrate: number; // in kbps
  audioCodec: string;
  videoCodec: string;
  fileSize: number; // in bytes
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
