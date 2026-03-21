import type { IngestIncomingVideoSourcePort } from '~/modules/ingest/application/ports/ingest-incoming-video-source.port';
import type { IngestLibraryIntakePort } from '~/modules/ingest/application/ports/ingest-library-intake.port';
import { AddVideoToLibraryUseCase } from '~/modules/ingest/application/use-cases/add-video-to-library.usecase';
import { ScanIncomingVideosUseCase } from '~/modules/ingest/application/use-cases/scan-incoming-videos.usecase';
import { createIngestLegacyIncomingVideoSource } from './ingest-legacy-incoming-video-source';
import { createIngestLegacyLibraryIntake } from './ingest-legacy-library-intake';

export interface ServerIngestServices {
  addVideoToLibrary: AddVideoToLibraryUseCase;
  scanIncomingVideos: ScanIncomingVideosUseCase;
}

interface ServerIngestServiceDependencies {
  incomingVideoSource: IngestIncomingVideoSourcePort;
  libraryIntake: IngestLibraryIntakePort;
}

let cachedIngestServices: ServerIngestServices | null = null;

export function createServerIngestServices(
  overrides: Partial<ServerIngestServiceDependencies> = {},
): ServerIngestServices {
  const incomingVideoSource = overrides.incomingVideoSource ??
    createIngestLegacyIncomingVideoSource();
  const libraryIntake = overrides.libraryIntake ??
    createIngestLegacyLibraryIntake();

  return {
    addVideoToLibrary: new AddVideoToLibraryUseCase({
      libraryIntake,
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
