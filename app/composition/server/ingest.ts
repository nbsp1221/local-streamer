import { randomUUID } from 'node:crypto';
import type { IngestStagedUploadRepositoryPort } from '~/modules/ingest/application/ports/ingest-staged-upload-repository.port';
import type { IngestStagedUploadStoragePort } from '~/modules/ingest/application/ports/ingest-staged-upload-storage.port';
import type { IngestVideoMetadataWriterPort } from '~/modules/ingest/application/ports/ingest-video-metadata-writer.port';
import type { IngestVideoProcessingPort } from '~/modules/ingest/application/ports/ingest-video-processing.port';
import { CommitStagedUploadToLibraryUseCase } from '~/modules/ingest/application/use-cases/commit-staged-upload-to-library.usecase';
import { ReapExpiredStagedUploadsUseCase } from '~/modules/ingest/application/use-cases/reap-expired-staged-uploads.usecase';
import { RemoveStagedUploadUseCase } from '~/modules/ingest/application/use-cases/remove-staged-upload.usecase';
import { StartStagedUploadUseCase } from '~/modules/ingest/application/use-cases/start-staged-upload.usecase';
import { FfprobeIngestVideoAnalysisAdapter } from '~/modules/ingest/infrastructure/analysis/ffprobe-ingest-video-analysis.adapter';
import { FfmpegIngestVideoProcessingAdapter } from '~/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter';
import { FilesystemIngestStagedUploadStorageAdapter } from '~/modules/ingest/infrastructure/staging/filesystem-ingest-staged-upload-storage.adapter';
import { SqliteIngestStagedUploadRepositoryAdapter } from '~/modules/ingest/infrastructure/staging/sqlite-ingest-staged-upload-repository.adapter';
import { BunStreamingMultipartUploadAdapter } from '~/modules/ingest/infrastructure/upload/bun-streaming-multipart-upload.adapter';
import { SqliteCanonicalVideoMetadataAdapter } from '~/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter';
import { getVideoMetadataConfig } from '~/shared/config/video-metadata.server';

export interface ServerIngestServices {
  commitStagedUploadToLibrary: CommitStagedUploadToLibraryUseCase;
  removeStagedUpload: RemoveStagedUploadUseCase;
  startStagedUpload: StartStagedUploadUseCase;
  uploadBrowserFile: BunStreamingMultipartUploadAdapter;
}

interface ServerIngestServiceDependencies {
  stagedUploadRepository: IngestStagedUploadRepositoryPort;
  stagedUploadStorage: IngestStagedUploadStoragePort;
  videoMetadataWriter: IngestVideoMetadataWriterPort;
  videoProcessing: IngestVideoProcessingPort;
  uploadBrowserFile: BunStreamingMultipartUploadAdapter;
}

let cachedIngestServices: ServerIngestServices | null = null;

function createLazyValue<T>(factory: () => T): () => T {
  const uninitialized = Symbol('uninitialized');
  let cachedValue: T | typeof uninitialized = uninitialized;

  return () => {
    if (cachedValue !== uninitialized) {
      return cachedValue;
    }

    cachedValue = factory();
    return cachedValue;
  };
}

export function createServerIngestServices(
  overrides: Partial<ServerIngestServiceDependencies> = {},
): ServerIngestServices {
  const getStagedUploadRepository = createLazyValue(() => overrides.stagedUploadRepository ?? new SqliteIngestStagedUploadRepositoryAdapter({
    dbPath: getVideoMetadataConfig().sqlitePath,
  }));
  const getStagedUploadStorage = createLazyValue(() => overrides.stagedUploadStorage ?? new FilesystemIngestStagedUploadStorageAdapter());
  const getVideoMetadataWriter = createLazyValue(() => overrides.videoMetadataWriter ?? new SqliteCanonicalVideoMetadataAdapter());
  const getVideoProcessing = createLazyValue(() => overrides.videoProcessing ?? new FfmpegIngestVideoProcessingAdapter());
  const getUploadBrowserFile = createLazyValue(() => overrides.uploadBrowserFile ?? new BunStreamingMultipartUploadAdapter());
  const getReapExpiredStagedUploads = createLazyValue(() => new ReapExpiredStagedUploadsUseCase({
    stagedUploadRepository: getStagedUploadRepository(),
    stagedUploadStorage: getStagedUploadStorage(),
  }));
  const getStartStagedUpload = createLazyValue(() => new StartStagedUploadUseCase({
    createStagingId: randomUUID,
    reapExpiredStagedUploads: getReapExpiredStagedUploads(),
    stagedUploadRepository: getStagedUploadRepository(),
    stagedUploadStorage: getStagedUploadStorage(),
    stagingTtlMs: 24 * 60 * 60 * 1000,
  }));
  const getRemoveStagedUpload = createLazyValue(() => new RemoveStagedUploadUseCase({
    stagedUploadRepository: getStagedUploadRepository(),
    stagedUploadStorage: getStagedUploadStorage(),
  }));
  const getCommitStagedUploadToLibrary = createLazyValue(() => new CommitStagedUploadToLibraryUseCase({
    reapExpiredStagedUploads: getReapExpiredStagedUploads(),
    stagedUploadRepository: getStagedUploadRepository(),
    stagedUploadStorage: getStagedUploadStorage(),
    videoAnalysis: new FfprobeIngestVideoAnalysisAdapter(),
    videoMetadataWriter: getVideoMetadataWriter(),
    videoProcessing: getVideoProcessing(),
  }));

  return {
    get commitStagedUploadToLibrary() {
      return getCommitStagedUploadToLibrary();
    },
    get removeStagedUpload() {
      return getRemoveStagedUpload();
    },
    get startStagedUpload() {
      return getStartStagedUpload();
    },
    get uploadBrowserFile() {
      return getUploadBrowserFile();
    },
  };
}

export function getServerIngestServices(): ServerIngestServices {
  if (cachedIngestServices) {
    return cachedIngestServices;
  }

  cachedIngestServices = createServerIngestServices();

  return cachedIngestServices;
}
