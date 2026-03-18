import type { IngestPendingVideo } from '../../domain/ingest-pending-video';

export interface IngestIncomingVideoSourcePort {
  scanIncomingVideos(): Promise<IngestPendingVideo[]>;
}
