import type { IngestPendingThumbnailEnricherPort } from '~/modules/ingest/application/ports/ingest-pending-thumbnail-enricher.port';
import type { IngestPendingVideoReaderPort } from '~/modules/ingest/application/ports/ingest-pending-video-reader.port';
import type { IngestPreparedVideoWorkspacePort } from '~/modules/ingest/application/ports/ingest-prepared-video-workspace.port';
import type { IngestUploadScanPort } from '~/modules/ingest/application/ports/ingest-upload-scan.port';
import type { IngestVideoMetadataWriterPort } from '~/modules/ingest/application/ports/ingest-video-metadata-writer.port';
import type { IngestVideoProcessingPort } from '~/modules/ingest/application/ports/ingest-video-processing.port';
import { AddVideoToLibraryUseCase } from '~/modules/ingest/application/use-cases/add-video-to-library.usecase';
import { LoadPendingUploadSnapshotUseCase } from '~/modules/ingest/application/use-cases/load-pending-upload-snapshot.usecase';
import { ScanIncomingVideosUseCase } from '~/modules/ingest/application/use-cases/scan-incoming-videos.usecase';
import { createCanonicalVideoMetadataLegacyStore } from './canonical-video-metadata-legacy-store';
import { createIngestLegacyPendingThumbnailEnricher } from './ingest-legacy-pending-thumbnail-enricher';
import { createIngestLegacyPendingVideoSource } from './ingest-legacy-pending-video-source';
import { createIngestLegacyPreparedVideoWorkspace } from './ingest-legacy-prepared-video-workspace';
import { createIngestLegacyUploadScan } from './ingest-legacy-upload-scan';
import { createIngestLegacyVideoProcessing } from './ingest-legacy-video-processing';

export interface ServerIngestServices {
  addVideoToLibrary: AddVideoToLibraryUseCase;
  loadPendingUploadSnapshot: LoadPendingUploadSnapshotUseCase;
  scanIncomingVideos: ScanIncomingVideosUseCase;
}

export interface ServerPendingUploadSnapshotServices {
  loadPendingUploadSnapshot: LoadPendingUploadSnapshotUseCase;
}

interface ServerIngestServiceDependencies {
  pendingThumbnailEnricher: IngestPendingThumbnailEnricherPort;
  pendingVideoReader: IngestPendingVideoReaderPort;
  preparedVideoWorkspace: IngestPreparedVideoWorkspacePort;
  uploadScan: IngestUploadScanPort;
  videoMetadataWriter: IngestVideoMetadataWriterPort;
  videoProcessing: IngestVideoProcessingPort;
}

let cachedIngestServices: ServerIngestServices | null = null;
let cachedPendingUploadSnapshotServices: ServerPendingUploadSnapshotServices | null = null;

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

function createLoadPendingUploadSnapshotUseCase(
  pendingVideoReader: IngestPendingVideoReaderPort,
): LoadPendingUploadSnapshotUseCase {
  return new LoadPendingUploadSnapshotUseCase({
    pendingVideoReader,
  });
}

export function createServerIngestServices(
  overrides: Partial<ServerIngestServiceDependencies> = {},
): ServerIngestServices {
  const getPendingThumbnailEnricher = createLazyValue(() => overrides.pendingThumbnailEnricher ?? createIngestLegacyPendingThumbnailEnricher());
  const getPendingVideoReader = createLazyValue(() => overrides.pendingVideoReader ?? createIngestLegacyPendingVideoSource());
  const getPreparedVideoWorkspace = createLazyValue(() => overrides.preparedVideoWorkspace ?? createIngestLegacyPreparedVideoWorkspace());
  const getUploadScan = createLazyValue(() => overrides.uploadScan ?? createIngestLegacyUploadScan());
  const getVideoMetadataWriter = createLazyValue(() => overrides.videoMetadataWriter ?? createCanonicalVideoMetadataLegacyStore());
  const getVideoProcessing = createLazyValue(() => overrides.videoProcessing ?? createIngestLegacyVideoProcessing());
  const getAddVideoToLibrary = createLazyValue(() => new AddVideoToLibraryUseCase({
    preparedVideoWorkspace: getPreparedVideoWorkspace(),
    videoProcessing: getVideoProcessing(),
    videoMetadataWriter: getVideoMetadataWriter(),
  }));
  const getLoadPendingUploadSnapshot = createLazyValue(() => createLoadPendingUploadSnapshotUseCase(getPendingVideoReader()));
  const getScanIncomingVideos = createLazyValue(() => new ScanIncomingVideosUseCase({
    pendingThumbnailEnricher: getPendingThumbnailEnricher(),
    uploadScan: getUploadScan(),
  }));

  return {
    get addVideoToLibrary() {
      return getAddVideoToLibrary();
    },
    get loadPendingUploadSnapshot() {
      return getLoadPendingUploadSnapshot();
    },
    get scanIncomingVideos() {
      return getScanIncomingVideos();
    },
  };
}

export function createServerPendingUploadSnapshotServices(
  overrides: Pick<Partial<ServerIngestServiceDependencies>, 'pendingVideoReader'> = {},
): ServerPendingUploadSnapshotServices {
  const pendingVideoReader = overrides.pendingVideoReader ??
    createIngestLegacyPendingVideoSource();

  return {
    loadPendingUploadSnapshot: createLoadPendingUploadSnapshotUseCase(pendingVideoReader),
  };
}

export function getServerIngestServices(): ServerIngestServices {
  if (cachedIngestServices) {
    return cachedIngestServices;
  }

  cachedIngestServices = createServerIngestServices();

  return cachedIngestServices;
}

export function getServerPendingUploadSnapshotServices(): ServerPendingUploadSnapshotServices {
  if (cachedPendingUploadSnapshotServices) {
    return cachedPendingUploadSnapshotServices;
  }

  cachedPendingUploadSnapshotServices = createServerPendingUploadSnapshotServices();

  return cachedPendingUploadSnapshotServices;
}
