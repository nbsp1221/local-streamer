import type {
  IngestMediaAnalysis,
  IngestMediaPreparationStrategy,
} from '~/modules/ingest/domain/media-preparation-policy';

export interface PrepareIngestMediaCommand {
  analysis: IngestMediaAnalysis;
  sourcePath: string;
  strategy: IngestMediaPreparationStrategy;
  title: string;
  videoId: string;
  workspaceRootDir?: string;
}

export interface PrepareIngestMediaResult {
  dashEnabled: boolean;
  message: string;
}

export interface FinalizeSuccessfulPreparedMediaCommand {
  title: string;
  videoId: string;
}

export interface IngestMediaPreparationPort {
  finalizeSuccessfulVideo(command: FinalizeSuccessfulPreparedMediaCommand): Promise<void>;
  prepareMedia(command: PrepareIngestMediaCommand): Promise<PrepareIngestMediaResult>;
}
