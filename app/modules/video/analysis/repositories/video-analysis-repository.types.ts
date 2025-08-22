export interface VideoMetadata {
  duration: number; // in seconds
  bitrate: number; // in kbps
  audioBitrate: number; // in kbps
  audioCodec: string;
  videoCodec: string;
  fileSize: number; // in bytes
}

export interface VideoAnalysisRepository {
  getVideoMetadata(filePath: string): Promise<VideoMetadata>;
}
