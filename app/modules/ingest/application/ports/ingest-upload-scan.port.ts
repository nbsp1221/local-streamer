import type { IngestPendingVideo } from '../../domain/ingest-pending-video';

export type DiscoveredIngestUpload = Pick<
  IngestPendingVideo,
  'createdAt' | 'filename' | 'id' | 'size' | 'type'
>;

export interface IngestUploadScanPort {
  discoverUploads(): Promise<DiscoveredIngestUpload[]>;
}
