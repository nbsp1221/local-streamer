import type { IngestMediaAnalysis } from '~/modules/ingest/domain/media-preparation-policy';

export interface IngestVideoAnalysisPort {
  analyze(inputPath: string): Promise<IngestMediaAnalysis>;
}
