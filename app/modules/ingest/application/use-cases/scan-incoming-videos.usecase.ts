import type { IngestPendingVideo } from '../../domain/ingest-pending-video';
import type { IngestIncomingVideoSourcePort } from '../ports/ingest-incoming-video-source.port';

interface ScanIncomingVideosUseCaseDependencies {
  incomingVideoSource: IngestIncomingVideoSourcePort;
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
      const files = await this.deps.incomingVideoSource.scanIncomingVideos();

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
