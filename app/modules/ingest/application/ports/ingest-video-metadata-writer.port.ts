import type { IngestVideoRecord } from '~/modules/ingest/domain/ingest-video-record';

export interface IngestVideoMetadataWriterPort {
  writeVideoRecord(record: IngestVideoRecord): Promise<void>;
}
