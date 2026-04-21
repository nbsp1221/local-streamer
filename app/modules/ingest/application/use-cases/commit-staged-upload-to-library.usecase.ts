import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { getStoragePaths } from '~/shared/config/storage-paths.server';
import type { IngestStagedUploadRepositoryPort } from '../ports/ingest-staged-upload-repository.port';
import type { IngestStagedUploadStoragePort } from '../ports/ingest-staged-upload-storage.port';
import type { IngestVideoMetadataWriterPort } from '../ports/ingest-video-metadata-writer.port';
import type { IngestEncodingOptions, IngestVideoProcessingPort } from '../ports/ingest-video-processing.port';
import type { ReapExpiredStagedUploadsUseCase } from './reap-expired-staged-uploads.usecase';

interface VideoAnalysisPort {
  analyze(inputPath: string): Promise<{ duration: number }>;
}

interface CommitStagedUploadToLibraryUseCaseDependencies {
  reapExpiredStagedUploads: Pick<ReapExpiredStagedUploadsUseCase, 'execute'>;
  stagedUploadRepository: IngestStagedUploadRepositoryPort;
  stagedUploadStorage: IngestStagedUploadStoragePort;
  videoAnalysis: VideoAnalysisPort;
  videoMetadataWriter: IngestVideoMetadataWriterPort;
  videoProcessing: IngestVideoProcessingPort;
}

interface CommitStagedUploadToLibraryCommand {
  description?: string;
  encodingOptions?: IngestEncodingOptions;
  stagingId: string;
  tags: string[];
  title: string;
}

export type CommitStagedUploadToLibraryUseCaseResult =
  | {
    ok: true;
    data: {
      dashEnabled: boolean;
      message: string;
      videoId: string;
    };
  }
  | {
    ok: false;
    message: string;
    reason: 'COMMIT_STAGED_UPLOAD_CONFLICT' | 'COMMIT_STAGED_UPLOAD_REJECTED' | 'COMMIT_STAGED_UPLOAD_NOT_FOUND' | 'COMMIT_STAGED_UPLOAD_UNAVAILABLE';
  };

export class CommitStagedUploadToLibraryUseCase {
  constructor(
    private readonly deps: CommitStagedUploadToLibraryUseCaseDependencies,
  ) {}

  async execute(command: CommitStagedUploadToLibraryCommand): Promise<CommitStagedUploadToLibraryUseCaseResult> {
    const trimmedTitle = command.title.trim();

    if (!trimmedTitle) {
      return {
        ok: false,
        message: 'Title cannot be empty',
        reason: 'COMMIT_STAGED_UPLOAD_REJECTED',
      };
    }

    await this.deps.reapExpiredStagedUploads.execute({
      referenceTime: new Date(),
    });

    const stagedUpload = await this.deps.stagedUploadRepository.findByStagingId(command.stagingId);

    if (!stagedUpload) {
      return createNotFoundResult();
    }

    if (stagedUpload.status === 'committed' && stagedUpload.committedVideoId) {
      return createAlreadyCommittedResult(stagedUpload.committedVideoId);
    }

    const commitLease = await this.deps.stagedUploadRepository.beginCommit(command.stagingId);
    if (commitLease === 'missing') {
      return createNotFoundResult();
    }

    if (commitLease === 'already_committing') {
      return {
        ok: false,
        message: 'Commit already in progress',
        reason: 'COMMIT_STAGED_UPLOAD_CONFLICT',
      };
    }

    if (commitLease === 'already_committed') {
      const committedUpload = await this.deps.stagedUploadRepository.findByStagingId(command.stagingId);

      if (committedUpload?.committedVideoId) {
        return createAlreadyCommittedResult(committedUpload.committedVideoId);
      }
    }

    const videoId = await this.deps.stagedUploadRepository.reserveCommittedVideoId(
      command.stagingId,
      randomUUID(),
    );

    if (!videoId) {
      await this.restoreUploadedStatus(command.stagingId);
      return createNotFoundResult();
    }

    const workspaceRootDir = path.join(getStoragePaths().videosDir, videoId);

    try {
      const analysis = await this.deps.videoAnalysis.analyze(stagedUpload.storagePath);
      const processed = await this.deps.videoProcessing.processPreparedVideo({
        encodingOptions: command.encodingOptions,
        sourcePath: stagedUpload.storagePath,
        title: trimmedTitle,
        videoId,
        workspaceRootDir,
      });

      if (!processed.dashEnabled) {
        return this.createUnavailableResult({
          message: processed.message,
          stagingId: command.stagingId,
          workspaceRootDir,
        });
      }

      await this.deps.videoMetadataWriter.writeVideoRecord({
        description: command.description?.trim() || undefined,
        duration: analysis.duration,
        id: videoId,
        tags: normalizeTags(command.tags),
        thumbnailUrl: `/api/thumbnail/${videoId}`,
        title: trimmedTitle,
        videoUrl: `/videos/${videoId}/manifest.mpd`,
      });
      await this.deps.stagedUploadRepository.update(command.stagingId, {
        committedVideoId: videoId,
        status: 'committed',
      });
      await this.deps.stagedUploadStorage.delete(stagedUpload.storagePath);
      await this.deps.videoProcessing.finalizeSuccessfulVideo({
        title: trimmedTitle,
        videoId,
      });

      return {
        ok: true,
        data: {
          dashEnabled: true,
          message: processed.message,
          videoId,
        },
      };
    }
    catch (error) {
      return this.createUnavailableResult({
        message: error instanceof Error ? error.message : 'Failed to commit staged upload',
        stagingId: command.stagingId,
        workspaceRootDir,
      });
    }
  }

  private async createUnavailableResult(input: {
    message: string;
    stagingId: string;
    workspaceRootDir: string;
  }): Promise<CommitStagedUploadToLibraryUseCaseResult> {
    await rm(input.workspaceRootDir, { force: true, recursive: true });
    await this.restoreUploadedStatus(input.stagingId);

    return {
      ok: false,
      message: input.message,
      reason: 'COMMIT_STAGED_UPLOAD_UNAVAILABLE',
    };
  }

  private async restoreUploadedStatus(stagingId: string): Promise<void> {
    await this.deps.stagedUploadRepository.update(stagingId, {
      status: 'uploaded',
    });
  }
}

function normalizeTags(tags: string[]): string[] {
  return tags
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0);
}

function createAlreadyCommittedResult(videoId: string): CommitStagedUploadToLibraryUseCaseResult {
  return {
    ok: true,
    data: {
      dashEnabled: true,
      message: 'Video already committed',
      videoId,
    },
  };
}

function createNotFoundResult(): CommitStagedUploadToLibraryUseCaseResult {
  return {
    ok: false,
    message: 'Staged upload not found',
    reason: 'COMMIT_STAGED_UPLOAD_NOT_FOUND',
  };
}
