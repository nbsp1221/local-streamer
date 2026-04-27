import type { IngestVideoRecord } from '~/modules/ingest/domain/ingest-video-record';

export interface IngestVideoMetadataWriterPort {
  deleteVideoRecord(id: string): Promise<void>;
  writeVideoRecord(record: IngestVideoRecord): Promise<void>;
}
