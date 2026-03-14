import type { LibraryHomeFilters } from '../../domain/library-home-filters';
import type { LibraryVideo } from '../../domain/library-video';
import type { LibraryVideoSourcePort } from '../ports/library-video-source.port';
import { createLibraryHomeFilters } from '../../domain/library-home-filters';

interface LoadLibraryCatalogSnapshotInput {
  rawQuery?: string | null;
  rawTags?: string[];
}

interface LoadLibraryCatalogSnapshotSuccess {
  ok: true;
  data: {
    videos: LibraryVideo[];
    filters: LibraryHomeFilters;
  };
}

interface LoadLibraryCatalogSnapshotFailure {
  ok: false;
  reason: 'CATALOG_SOURCE_UNAVAILABLE';
}

export type LoadLibraryCatalogSnapshotResult =
  | LoadLibraryCatalogSnapshotSuccess
  | LoadLibraryCatalogSnapshotFailure;

interface LoadLibraryCatalogSnapshotUseCaseDependencies {
  videoSource: LibraryVideoSourcePort;
}

export class LoadLibraryCatalogSnapshotUseCase {
  constructor(
    private readonly deps: LoadLibraryCatalogSnapshotUseCaseDependencies,
  ) {}

  async execute(input: LoadLibraryCatalogSnapshotInput): Promise<LoadLibraryCatalogSnapshotResult> {
    try {
      const videos = await this.deps.videoSource.listLibraryVideos();

      return {
        ok: true,
        data: {
          videos,
          filters: createLibraryHomeFilters(input),
        },
      };
    }
    catch {
      return {
        ok: false,
        reason: 'CATALOG_SOURCE_UNAVAILABLE',
      };
    }
  }
}
