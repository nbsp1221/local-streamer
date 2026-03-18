import type { IngestIncomingVideoSourcePort } from '~/modules/ingest/application/ports/ingest-incoming-video-source.port';
import { ScanIncomingVideosUseCase } from '~/modules/ingest/application/use-cases/scan-incoming-videos.usecase';
import { createIngestLegacyIncomingVideoSource } from './ingest-legacy-incoming-video-source';

export interface ServerIngestServices {
  scanIncomingVideos: ScanIncomingVideosUseCase;
}

interface ServerIngestServiceDependencies {
  incomingVideoSource: IngestIncomingVideoSourcePort;
}

let cachedIngestServices: ServerIngestServices | null = null;

export function createServerIngestServices(
  overrides: Partial<ServerIngestServiceDependencies> = {},
): ServerIngestServices {
  const incomingVideoSource = overrides.incomingVideoSource ??
    createIngestLegacyIncomingVideoSource();

  return {
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
