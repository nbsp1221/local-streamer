export interface VideoMetadata {
  // Basic metadata
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

export interface VideoAnalysisRepository {
  getVideoMetadata(filePath: string): Promise<VideoMetadata>;
}
