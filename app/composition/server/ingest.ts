import type { IngestIncomingVideoSourcePort } from '~/modules/ingest/application/ports/ingest-incoming-video-source.port';
import type { IngestLibraryIntakePort } from '~/modules/ingest/application/ports/ingest-library-intake.port';
import type { IngestVideoMetadataWriterPort } from '~/modules/ingest/application/ports/ingest-video-metadata-writer.port';
import { AddVideoToLibraryUseCase } from '~/modules/ingest/application/use-cases/add-video-to-library.usecase';
import { ScanIncomingVideosUseCase } from '~/modules/ingest/application/use-cases/scan-incoming-videos.usecase';
import { createCanonicalVideoMetadataLegacyStore } from './canonical-video-metadata-legacy-store';
import { createIngestLegacyIncomingVideoSource } from './ingest-legacy-incoming-video-source';
import { createIngestLegacyLibraryIntake } from './ingest-legacy-library-intake';

export interface ServerIngestServices {
  addVideoToLibrary: AddVideoToLibraryUseCase;
  scanIncomingVideos: ScanIncomingVideosUseCase;
}

interface ServerIngestServiceDependencies {
  incomingVideoSource: IngestIncomingVideoSourcePort;
  libraryIntake: IngestLibraryIntakePort;
  videoMetadataWriter: IngestVideoMetadataWriterPort;
}

let cachedIngestServices: ServerIngestServices | null = null;

export function createServerIngestServices(
  overrides: Partial<ServerIngestServiceDependencies> = {},
): ServerIngestServices {
  const incomingVideoSource = overrides.incomingVideoSource ??
    createIngestLegacyIncomingVideoSource();
  const libraryIntake = overrides.libraryIntake ??
    createIngestLegacyLibraryIntake();
  const videoMetadataWriter = overrides.videoMetadataWriter ??
    createCanonicalVideoMetadataLegacyStore();

  return {
    addVideoToLibrary: new AddVideoToLibraryUseCase({
      libraryIntake,
      videoMetadataWriter,
    }),
    scanIncomingVideos: new ScanIncomingVideosUseCase({
      incomingVideoSource,
    }),
  };
}

export function getServerIngestServices(): ServerIngestServices {
  if (cachedIngestServices) {
    return cachedIngestServices;
  }

  cachedIngestServices = createServerIngestServices();

  return cachedIngestServices;
}
