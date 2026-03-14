import type { PendingVideo, SearchFilters } from '~/legacy/types/video';
import type { LoadLibraryCatalogSnapshotResult } from '~/modules/library/application/use-cases/load-library-catalog-snapshot.usecase';
import type { LibraryHomeFilters } from '~/modules/library/domain/library-home-filters';
import type { LibraryVideo } from '~/modules/library/domain/library-video';
import { type ServerLibraryServices, getServerLibraryServices } from './library';
import {
  type PendingVideosCompatReader,
  createPendingVideosCompatReader,
} from './pending-videos-compat-reader';

interface LoadHomeLibraryPageDataInput {
  rawQuery?: string | null;
  rawTags?: string[];
}

interface LoadHomeLibraryPageDataSuccess {
  ok: true;
  data: {
    videos: LibraryVideo[];
    pendingVideos: PendingVideo[];
    initialFilters: SearchFilters;
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

interface HomeLibraryPageServiceDependencies {
  libraryServices: ServerLibraryServices;
  pendingVideosReader: PendingVideosCompatReader;
}

let cachedHomeLibraryPageServices: HomeLibraryPageServices | null = null;

function createHomeLibraryUnavailableFailure(): LoadHomeLibraryPageDataFailure {
  return {
    ok: false,
    reason: 'HOME_DATA_UNAVAILABLE',
  };
}

function toLegacyBootstrapTags(rawTags: string[]): string[] {
  const seenTags = new Set<string>();

  return rawTags.reduce<string[]>((tags, rawTag) => {
    const tag = rawTag.trim();

    if (tag.length === 0) {
      return tags;
    }

    const normalizedTag = tag.toLowerCase();

    if (seenTags.has(normalizedTag)) {
      return tags;
    }

    seenTags.add(normalizedTag);
    tags.push(tag);

    return tags;
  }, []);
}

function createLegacyInitialFilters(filters: LibraryHomeFilters): SearchFilters {
  return {
    query: filters.displayQuery,
    tags: toLegacyBootstrapTags(filters.rawTags),
  };
}

function mapCatalogResultToHomePageData(
  result: Extract<LoadLibraryCatalogSnapshotResult, { ok: true }>,
  pendingVideos: PendingVideo[],
): LoadHomeLibraryPageDataSuccess {
  return {
    ok: true,
    data: {
      videos: result.data.videos,
      pendingVideos,
      initialFilters: createLegacyInitialFilters(result.data.filters),
    },
  };
}

function resolveDependencies(
  overrides: Partial<HomeLibraryPageServiceDependencies>,
): HomeLibraryPageServiceDependencies {
  return {
    libraryServices: overrides.libraryServices ?? getServerLibraryServices(),
    pendingVideosReader: overrides.pendingVideosReader ?? createPendingVideosCompatReader(),
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
          const pendingVideos = await deps.pendingVideosReader.readPendingVideos();

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
