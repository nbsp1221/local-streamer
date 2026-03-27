import type { LibraryVideoArtifactRemovalPort } from '~/modules/library/application/ports/library-video-artifact-removal.port';
import type { LibraryVideoMutationPort } from '~/modules/library/application/ports/library-video-mutation.port';
import type { LibraryVideoSourcePort } from '~/modules/library/application/ports/library-video-source.port';
import { DeleteLibraryVideoUseCase } from '~/modules/library/application/use-cases/delete-library-video.usecase';
import { LoadLibraryCatalogSnapshotUseCase } from '~/modules/library/application/use-cases/load-library-catalog-snapshot.usecase';
import { UpdateLibraryVideoUseCase } from '~/modules/library/application/use-cases/update-library-video.usecase';
import { createCanonicalVideoMetadataLegacyStore } from './canonical-video-metadata-legacy-store';
import {
  createLibraryLegacyVideoArtifactRemovalPort,
  createLibraryLegacyVideoMutationPort,
} from './library-legacy-video-mutation';

export interface LoadLibraryCatalogSnapshotService {
  execute: LoadLibraryCatalogSnapshotUseCase['execute'];
}

export interface ServerLibraryServices {
  deleteLibraryVideo: DeleteLibraryVideoUseCase;
  loadLibraryCatalogSnapshot: LoadLibraryCatalogSnapshotService;
  updateLibraryVideo: UpdateLibraryVideoUseCase;
}

interface ServerLibraryServiceDependencies {
  artifactRemovalPort: LibraryVideoArtifactRemovalPort;
  mutationPort: LibraryVideoMutationPort;
  videoSource: LibraryVideoSourcePort;
}

let cachedLibraryServices: ServerLibraryServices | null = null;

function resolveDependencies(
  overrides: Partial<ServerLibraryServiceDependencies>,
): ServerLibraryServiceDependencies {
  return {
    artifactRemovalPort: overrides.artifactRemovalPort ?? createLibraryLegacyVideoArtifactRemovalPort(),
    mutationPort: overrides.mutationPort ?? createLibraryLegacyVideoMutationPort(),
    videoSource: overrides.videoSource ?? createCanonicalVideoMetadataLegacyStore(),
  };
}

export function createServerLibraryServices(
  overrides: Partial<ServerLibraryServiceDependencies> = {},
): ServerLibraryServices {
  const deps = resolveDependencies(overrides);

  return {
    deleteLibraryVideo: new DeleteLibraryVideoUseCase({
      videoArtifacts: deps.artifactRemovalPort,
      videoMutation: deps.mutationPort,
    }),
    loadLibraryCatalogSnapshot: new LoadLibraryCatalogSnapshotUseCase({
      videoSource: deps.videoSource,
    }),
    updateLibraryVideo: new UpdateLibraryVideoUseCase({
      videoMutation: deps.mutationPort,
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
