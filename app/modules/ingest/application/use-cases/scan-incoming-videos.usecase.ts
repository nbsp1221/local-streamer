import type { IngestPendingVideo } from '../../domain/ingest-pending-video';
import type { IngestPendingThumbnailEnricherPort } from '../ports/ingest-pending-thumbnail-enricher.port';
import type { IngestUploadScanPort } from '../ports/ingest-upload-scan.port';

interface ScanIncomingVideosUseCaseDependencies {
  pendingThumbnailEnricher: IngestPendingThumbnailEnricherPort;
  uploadScan: IngestUploadScanPort;
}

type ScanIncomingVideosSuccess = {
  ok: true;
  data: {
    files: IngestPendingVideo[];
    count: number;
  };
};

type ScanIncomingVideosFailure = {
  ok: false;
  reason: 'INCOMING_SCAN_UNAVAILABLE';
};

export type ScanIncomingVideosUseCaseResult =
  | ScanIncomingVideosSuccess
  | ScanIncomingVideosFailure;

export class ScanIncomingVideosUseCase {
  constructor(
    private readonly deps: ScanIncomingVideosUseCaseDependencies,
  ) {}

  async execute(): Promise<ScanIncomingVideosUseCaseResult> {
    try {
      const discoveredUploads = await this.deps.uploadScan.discoverUploads();
      const files = await this.deps.pendingThumbnailEnricher.enrichPendingUploads(discoveredUploads);

      return {
        ok: true,
        data: {
          files,
          count: files.length,
        },
      };
    }
    catch {
      return {
        ok: false,
        reason: 'INCOMING_SCAN_UNAVAILABLE',
      };
    }
  }
}
