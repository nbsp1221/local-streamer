import type { LibraryVideoSourcePort } from '~/modules/library/application/ports/library-video-source.port';
import { LoadLibraryCatalogSnapshotUseCase } from '~/modules/library/application/use-cases/load-library-catalog-snapshot.usecase';
import { createLibraryLegacyVideoSource } from './library-legacy-video-source';

export interface LoadLibraryCatalogSnapshotService {
  execute: LoadLibraryCatalogSnapshotUseCase['execute'];
}

export interface ServerLibraryServices {
  loadLibraryCatalogSnapshot: LoadLibraryCatalogSnapshotService;
}

interface ServerLibraryServiceDependencies {
  videoSource: LibraryVideoSourcePort;
}

let cachedLibraryServices: ServerLibraryServices | null = null;

function createDefaultDependencies(): ServerLibraryServiceDependencies {
  return {
    videoSource: createLibraryLegacyVideoSource(),
  };
}

function resolveDependencies(
  overrides: Partial<ServerLibraryServiceDependencies>,
): ServerLibraryServiceDependencies {
  return {
    videoSource: overrides.videoSource ?? createDefaultDependencies().videoSource,
  };
}

export function createServerLibraryServices(
  overrides: Partial<ServerLibraryServiceDependencies> = {},
): ServerLibraryServices {
  const deps = resolveDependencies(overrides);

  return {
    loadLibraryCatalogSnapshot: new LoadLibraryCatalogSnapshotUseCase({
      videoSource: deps.videoSource,
    }),
  };
}

export function getServerLibraryServices(): ServerLibraryServices {
  if (cachedLibraryServices) {
    return cachedLibraryServices;
  }

  cachedLibraryServices = createServerLibraryServices();

  return cachedLibraryServices;
}
