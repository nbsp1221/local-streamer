import type { PendingLibraryItem } from '~/entities/pending-video/model/pending-video';
import type { LoadLibraryCatalogSnapshotResult } from '~/modules/library/application/use-cases/load-library-catalog-snapshot.usecase';
import type { LibraryVideo } from '~/modules/library/domain/library-video';
import {
  type HomePendingLibraryItemSource,
  createHomeLegacyPendingVideoSource,
} from './home-legacy-pending-video-source';
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

interface HomeLibraryPageServiceDependencies {
  libraryServices: HomeLibraryReadServices;
  pendingVideosSource: HomePendingLibraryItemSource;
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

function resolveDependencies(
  overrides: Partial<HomeLibraryPageServiceDependencies>,
): HomeLibraryPageServiceDependencies {
  return {
    libraryServices: overrides.libraryServices ?? getServerLibraryServices(),
    pendingVideosSource: overrides.pendingVideosSource ?? createHomeLegacyPendingVideoSource(),
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

        try {
          const pendingVideos = await deps.pendingVideosSource.readPendingLibraryItems();

          return mapCatalogResultToHomePageData(catalogResult, pendingVideos);
        }
        catch {
          return createHomeLibraryUnavailableFailure();
        }
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
