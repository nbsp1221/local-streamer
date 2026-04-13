import type { LibraryVideoArtifactRemovalPort } from '~/modules/library/application/ports/library-video-artifact-removal.port';
import type { LibraryVideoMutationPort } from '~/modules/library/application/ports/library-video-mutation.port';
import type { LibraryVideoSourcePort } from '~/modules/library/application/ports/library-video-source.port';
import { DeleteLibraryVideoUseCase } from '~/modules/library/application/use-cases/delete-library-video.usecase';
import { LoadLibraryCatalogSnapshotUseCase } from '~/modules/library/application/use-cases/load-library-catalog-snapshot.usecase';
import { UpdateLibraryVideoUseCase } from '~/modules/library/application/use-cases/update-library-video.usecase';
import { SqliteCanonicalVideoMetadataAdapter } from '~/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter';
import { SqliteLibraryVideoMutationAdapter } from '~/modules/library/infrastructure/sqlite/sqlite-library-video-mutation.adapter';
import { FilesystemLibraryVideoArtifactRemovalAdapter } from '~/modules/library/infrastructure/storage/filesystem-library-video-artifact-removal.adapter';

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
    artifactRemovalPort: overrides.artifactRemovalPort ?? new FilesystemLibraryVideoArtifactRemovalAdapter(),
    mutationPort: overrides.mutationPort ?? new SqliteLibraryVideoMutationAdapter(),
    videoSource: overrides.videoSource ?? new SqliteCanonicalVideoMetadataAdapter(),
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
