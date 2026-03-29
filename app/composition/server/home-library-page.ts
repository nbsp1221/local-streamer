import type { PendingLibraryItem } from '~/entities/pending-video/model/pending-video';
import type { IngestPendingVideo } from '~/modules/ingest/domain/ingest-pending-video';
import type { LoadLibraryCatalogSnapshotResult } from '~/modules/library/application/use-cases/load-library-catalog-snapshot.usecase';
import type { LibraryVideo } from '~/modules/library/domain/library-video';
import { getServerPendingUploadSnapshotServices } from './ingest';
import { getServerLibraryServices } from './library';

interface LoadHomeLibraryPageDataInput {
  rawQuery?: string | null;
  rawTags?: string[];
}

interface LoadHomeLibraryPageDataSuccess {
  ok: true;
  data: {
    videos: LibraryVideo[];
    pendingVideos: PendingLibraryItem[];
  };
}

interface LoadHomeLibraryPageDataFailure {
  ok: false;
  reason: 'HOME_DATA_UNAVAILABLE';
}

type PendingLibraryItemSource = Pick<IngestPendingVideo, 'filename' | 'id' | 'size' | 'type'>;

export type LoadHomeLibraryPageDataResult =
  | LoadHomeLibraryPageDataSuccess
  | LoadHomeLibraryPageDataFailure;

interface HomeLibraryPageServices {
  loadHomeLibraryPageData: {
    execute(input: LoadHomeLibraryPageDataInput): Promise<LoadHomeLibraryPageDataResult>;
  };
}

interface HomeLibraryReadServices {
  loadLibraryCatalogSnapshot: {
    execute: ReturnType<typeof getServerLibraryServices>['loadLibraryCatalogSnapshot']['execute'];
  };
}

interface HomeLibraryIngestServices {
  loadPendingUploadSnapshot: {
    execute: ReturnType<typeof getServerPendingUploadSnapshotServices>['loadPendingUploadSnapshot']['execute'];
  };
}

interface HomeLibraryPageServiceDependencies {
  ingestServices: HomeLibraryIngestServices;
  libraryServices: HomeLibraryReadServices;
}

let cachedHomeLibraryPageServices: HomeLibraryPageServices | null = null;

function createHomeLibraryUnavailableFailure(): LoadHomeLibraryPageDataFailure {
  return {
    ok: false,
    reason: 'HOME_DATA_UNAVAILABLE',
  };
}

function mapCatalogResultToHomePageData(
  result: Extract<LoadLibraryCatalogSnapshotResult, { ok: true }>,
  pendingVideos: PendingLibraryItem[],
): LoadHomeLibraryPageDataSuccess {
  return {
    ok: true,
    data: {
      videos: result.data.videos,
      pendingVideos,
    },
  };
}

function toPendingLibraryItem({
  filename,
  id,
  size,
  type,
}: PendingLibraryItemSource): PendingLibraryItem {
  return {
    filename,
    id,
    size,
    type,
  };
}

function toPendingLibraryItems(files: IngestPendingVideo[]): PendingLibraryItem[] {
  return files.map(toPendingLibraryItem);
}

async function loadPendingLibraryItems(
  ingestServices: HomeLibraryIngestServices,
): Promise<PendingLibraryItem[] | null> {
  try {
    const pendingSnapshot = await ingestServices.loadPendingUploadSnapshot.execute();

    if (!pendingSnapshot.ok) {
      return null;
    }

    return toPendingLibraryItems(pendingSnapshot.data.files);
  }
  catch {
    return null;
  }
}

function resolveDependencies(
  overrides: Partial<HomeLibraryPageServiceDependencies>,
): HomeLibraryPageServiceDependencies {
  return {
    ingestServices: overrides.ingestServices ?? getServerPendingUploadSnapshotServices(),
    libraryServices: overrides.libraryServices ?? getServerLibraryServices(),
  };
}

export function createHomeLibraryPageServices(
  overrides: Partial<HomeLibraryPageServiceDependencies> = {},
): HomeLibraryPageServices {
  const deps = resolveDependencies(overrides);

  return {
    loadHomeLibraryPageData: {
      async execute(input) {
        const catalogResult = await deps.libraryServices.loadLibraryCatalogSnapshot.execute(input);

        if (!catalogResult.ok) {
          return createHomeLibraryUnavailableFailure();
        }

        const pendingVideos = await loadPendingLibraryItems(deps.ingestServices);

        if (!pendingVideos) {
          return createHomeLibraryUnavailableFailure();
        }

        return mapCatalogResultToHomePageData(catalogResult, pendingVideos);
      },
    },
  };
}

export function getHomeLibraryPageServices(): HomeLibraryPageServices {
  if (cachedHomeLibraryPageServices) {
    return cachedHomeLibraryPageServices;
  }

  cachedHomeLibraryPageServices = createHomeLibraryPageServices();

  return cachedHomeLibraryPageServices;
}
