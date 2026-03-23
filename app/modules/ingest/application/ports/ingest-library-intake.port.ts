export interface IngestEncodingOptions {
  encoder: 'cpu-h264' | 'gpu-h264' | 'cpu-h265' | 'gpu-h265';
}

export interface AddVideoToLibraryCommand {
  filename: string;
  title: string;
  tags: string[];
  description?: string;
  encodingOptions?: IngestEncodingOptions;
}

export interface PrepareVideoForLibraryCommand {
  filename: string;
  title: string;
  videoId: string;
}

export interface PreparedVideoForLibraryData {
  duration: number;
  sourcePath: string;
}

export interface ProcessPreparedVideoCommand {
  encodingOptions?: IngestEncodingOptions;
  sourcePath: string;
  title: string;
  videoId: string;
}

export interface ProcessPreparedVideoResult {
  dashEnabled: boolean;
  message: string;
}

export interface RecoverFailedPreparedVideoCommand {
  filename: string;
  videoId: string;
}

export type RecoverFailedPreparedVideoRetryAvailability =
  | 'already_available'
  | 'restored'
  | 'unavailable';

export interface RecoverFailedPreparedVideoResult {
  restoredThumbnail: boolean;
  retryAvailability: RecoverFailedPreparedVideoRetryAvailability;
}

export interface FinalizeSuccessfulPreparedVideoCommand {
  title: string;
  videoId: string;
}

export interface AddVideoToLibrarySuccessData {
  videoId: string;
  message: string;
  dashEnabled: boolean;
}

export interface IngestLibraryIntakePort {
  finalizeSuccessfulPreparedVideo(command: FinalizeSuccessfulPreparedVideoCommand): Promise<void>;
  prepareVideoForLibrary(command: PrepareVideoForLibraryCommand): Promise<PreparedVideoForLibraryData>;
  processPreparedVideo(command: ProcessPreparedVideoCommand): Promise<ProcessPreparedVideoResult>;
  recoverFailedPreparedVideo(
    command: RecoverFailedPreparedVideoCommand,
  ): Promise<RecoverFailedPreparedVideoResult>;
}
