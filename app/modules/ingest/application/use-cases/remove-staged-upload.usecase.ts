import type { IngestStagedUploadRepositoryPort } from '../ports/ingest-staged-upload-repository.port';
import type { IngestStagedUploadStoragePort } from '../ports/ingest-staged-upload-storage.port';

interface RemoveStagedUploadUseCaseDependencies {
  stagedUploadRepository: IngestStagedUploadRepositoryPort;
  stagedUploadStorage: IngestStagedUploadStoragePort;
}

interface RemoveStagedUploadCommand {
  stagingId: string;
}

export type RemoveStagedUploadUseCaseResult =
  | {
    ok: true;
  }
  | {
    ok: false;
    message: string;
    reason: 'REMOVE_STAGED_UPLOAD_CONFLICT';
  };

export class RemoveStagedUploadUseCase {
  constructor(
    private readonly deps: RemoveStagedUploadUseCaseDependencies,
  ) {}

  async execute(command: RemoveStagedUploadCommand): Promise<RemoveStagedUploadUseCaseResult> {
    const stagedUpload = await this.deps.stagedUploadRepository.findByStagingId(command.stagingId);

    if (!stagedUpload || stagedUpload.status === 'committed') {
      return {
        ok: true,
      };
    }

    if (stagedUpload.status === 'committing') {
      return {
        ok: false,
        message: 'Commit already in progress',
        reason: 'REMOVE_STAGED_UPLOAD_CONFLICT',
      };
    }

    await this.deps.stagedUploadStorage.delete(stagedUpload.storagePath);
    await this.deps.stagedUploadRepository.delete(command.stagingId);

    return {
      ok: true,
    };
  }
}
