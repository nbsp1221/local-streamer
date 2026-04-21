export interface IngestEncodingOptions {
  encoder: 'cpu-h264' | 'gpu-h264' | 'cpu-h265' | 'gpu-h265';
}

export interface ProcessPreparedVideoCommand {
  encodingOptions?: IngestEncodingOptions;
  sourcePath: string;
  title: string;
  videoId: string;
  workspaceRootDir?: string;
}

export interface ProcessPreparedVideoResult {
  dashEnabled: boolean;
  message: string;
}

export interface FinalizeSuccessfulPreparedVideoCommand {
  title: string;
  videoId: string;
}

export interface IngestVideoProcessingPort {
  finalizeSuccessfulVideo(command: FinalizeSuccessfulPreparedVideoCommand): Promise<void>;
  processPreparedVideo(command: ProcessPreparedVideoCommand): Promise<ProcessPreparedVideoResult>;
}
