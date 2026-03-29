import type {
  PreparedVideoForLibraryData,
  PrepareVideoForLibraryCommand,
  RecoverFailedPreparedVideoCommand,
  RecoverFailedPreparedVideoResult,
} from './ingest-library-intake.port';

export interface IngestPreparedVideoWorkspacePort {
  preparePreparedVideo(command: PrepareVideoForLibraryCommand): Promise<PreparedVideoForLibraryData>;
  recoverPreparedVideo(command: RecoverFailedPreparedVideoCommand): Promise<RecoverFailedPreparedVideoResult>;
}
