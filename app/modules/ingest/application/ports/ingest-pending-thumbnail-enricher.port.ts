import type { IngestPendingVideo } from '../../domain/ingest-pending-video';
import type { DiscoveredIngestUpload } from './ingest-upload-scan.port';

export interface IngestPendingThumbnailEnricherPort {
  enrichPendingUploads(files: DiscoveredIngestUpload[]): Promise<IngestPendingVideo[]>;
}
