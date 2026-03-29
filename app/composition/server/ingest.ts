import type { IngestIncomingVideoSourcePort } from '~/modules/ingest/application/ports/ingest-incoming-video-source.port';
import type { IngestPendingVideoReaderPort } from '~/modules/ingest/application/ports/ingest-pending-video-reader.port';
import type { IngestPreparedVideoWorkspacePort } from '~/modules/ingest/application/ports/ingest-prepared-video-workspace.port';
import type { IngestVideoMetadataWriterPort } from '~/modules/ingest/application/ports/ingest-video-metadata-writer.port';
import type { IngestVideoProcessingPort } from '~/modules/ingest/application/ports/ingest-video-processing.port';
import { AddVideoToLibraryUseCase } from '~/modules/ingest/application/use-cases/add-video-to-library.usecase';
import { LoadPendingUploadSnapshotUseCase } from '~/modules/ingest/application/use-cases/load-pending-upload-snapshot.usecase';
import { ScanIncomingVideosUseCase } from '~/modules/ingest/application/use-cases/scan-incoming-videos.usecase';
import { createCanonicalVideoMetadataLegacyStore } from './canonical-video-metadata-legacy-store';
import { createIngestLegacyIncomingVideoSource } from './ingest-legacy-incoming-video-source';
import { createIngestLegacyPendingVideoSource } from './ingest-legacy-pending-video-source';
import { createIngestLegacyPreparedVideoWorkspace } from './ingest-legacy-prepared-video-workspace';
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
  incomingVideoSource: IngestIncomingVideoSourcePort;
  pendingVideoReader: IngestPendingVideoReaderPort;
  preparedVideoWorkspace: IngestPreparedVideoWorkspacePort;
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
  const getIncomingVideoSource = createLazyValue(() => overrides.incomingVideoSource ?? createIngestLegacyIncomingVideoSource());
  const getPendingVideoReader = createLazyValue(() => overrides.pendingVideoReader ?? createIngestLegacyPendingVideoSource());
  const getPreparedVideoWorkspace = createLazyValue(() => overrides.preparedVideoWorkspace ?? createIngestLegacyPreparedVideoWorkspace());
  const getVideoMetadataWriter = createLazyValue(() => overrides.videoMetadataWriter ?? createCanonicalVideoMetadataLegacyStore());
  const getVideoProcessing = createLazyValue(() => overrides.videoProcessing ?? createIngestLegacyVideoProcessing());
  const getAddVideoToLibrary = createLazyValue(() => new AddVideoToLibraryUseCase({
    preparedVideoWorkspace: getPreparedVideoWorkspace(),
    videoProcessing: getVideoProcessing(),
    videoMetadataWriter: getVideoMetadataWriter(),
  }));
  const getLoadPendingUploadSnapshot = createLazyValue(() => createLoadPendingUploadSnapshotUseCase(getPendingVideoReader()));
  const getScanIncomingVideos = createLazyValue(() => new ScanIncomingVideosUseCase({
    incomingVideoSource: getIncomingVideoSource(),
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
