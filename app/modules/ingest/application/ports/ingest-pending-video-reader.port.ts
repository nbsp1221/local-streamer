import type { IngestPendingVideo } from '../../domain/ingest-pending-video';

export interface IngestPendingVideoReaderPort {
  readPendingUploads(): Promise<IngestPendingVideo[]>;
}
