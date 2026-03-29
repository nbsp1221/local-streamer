import type { IngestPendingVideo } from '../../domain/ingest-pending-video';
import type { IngestPendingVideoReaderPort } from '../ports/ingest-pending-video-reader.port';

interface LoadPendingUploadSnapshotUseCaseDependencies {
  pendingVideoReader: IngestPendingVideoReaderPort;
}

type LoadPendingUploadSnapshotSuccess = {
  ok: true;
  data: {
    files: IngestPendingVideo[];
    count: number;
  };
};

type LoadPendingUploadSnapshotFailure = {
  ok: false;
  reason: 'PENDING_UPLOAD_SNAPSHOT_UNAVAILABLE';
};

export type LoadPendingUploadSnapshotUseCaseResult =
  | LoadPendingUploadSnapshotSuccess
  | LoadPendingUploadSnapshotFailure;

export class LoadPendingUploadSnapshotUseCase {
  constructor(
    private readonly deps: LoadPendingUploadSnapshotUseCaseDependencies,
  ) {}

  async execute(): Promise<LoadPendingUploadSnapshotUseCaseResult> {
    try {
      const files = await this.deps.pendingVideoReader.readPendingUploads();

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
        reason: 'PENDING_UPLOAD_SNAPSHOT_UNAVAILABLE',
      };
    }
  }
}
