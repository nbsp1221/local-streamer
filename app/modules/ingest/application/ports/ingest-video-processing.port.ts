import type {
  FinalizeSuccessfulPreparedVideoCommand,
  ProcessPreparedVideoCommand,
  ProcessPreparedVideoResult,
} from './ingest-library-intake.port';

export interface IngestVideoProcessingPort {
  finalizeSuccessfulVideo(command: FinalizeSuccessfulPreparedVideoCommand): Promise<void>;
  processPreparedVideo(command: ProcessPreparedVideoCommand): Promise<ProcessPreparedVideoResult>;
}
