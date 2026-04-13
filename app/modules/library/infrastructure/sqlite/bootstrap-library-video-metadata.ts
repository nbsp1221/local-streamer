import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { LibraryVideo } from '~/modules/library/domain/library-video';
import type { SqliteLibraryVideoMetadataRepository } from './sqlite-library-video-metadata.repository';

type BootstrapAwareRepository = Pick<
  SqliteLibraryVideoMetadataRepository,
  'bootstrapFromVideos' | 'isBootstrapComplete'
>;

export type ReadBootstrapLibraryVideos = () => Promise<LibraryVideo[]>;

const inFlightBootstrapPromises = new Map<string, Promise<void>>();

export function createLibraryVideoMetadataBootstrapGuard(
  deps: {
    bootstrapKey: string;
    readBootstrapVideos: ReadBootstrapLibraryVideos;
    repository: BootstrapAwareRepository;
  },
) {
  return async function ensureBootstrapped() {
    const inFlightBootstrap = inFlightBootstrapPromises.get(deps.bootstrapKey);

    if (inFlightBootstrap) {
      await inFlightBootstrap;
      return;
    }

    let resolveBootstrap!: () => void;
    let rejectBootstrap!: (error: unknown) => void;
    const bootstrapPromise = new Promise<void>((resolve, reject) => {
      resolveBootstrap = resolve;
      rejectBootstrap = reject;
    });

    inFlightBootstrapPromises.set(deps.bootstrapKey, bootstrapPromise);

    try {
      const bootstrapComplete = await deps.repository.isBootstrapComplete();

      if (!bootstrapComplete) {
        const bootstrapVideos = await deps.readBootstrapVideos();
        await deps.repository.bootstrapFromVideos(bootstrapVideos);
      }

      resolveBootstrap();
    }
    catch (error) {
      rejectBootstrap(error);
      throw error;
    }
    finally {
      inFlightBootstrapPromises.delete(deps.bootstrapKey);
    }

    await bootstrapPromise;
  };
}

function resolveLegacyVideoCreatedAtTimestamp(video: {
  addedAt?: string;
  createdAt?: string;
}) {
  return video.createdAt || video.addedAt || 0;
}

export const readBootstrapLibraryVideos: ReadBootstrapLibraryVideos = async () => {
  const storageDir = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');
  const bootstrapPath = path.join(storageDir, 'data', 'videos.json');

  try {
    const raw = await readFile(bootstrapPath, 'utf8');
    const parsed = JSON.parse(raw) as Array<{
      addedAt?: string;
      createdAt?: string;
      description?: string;
      duration: number;
      id: string;
      tags: string[];
      thumbnailUrl?: string;
      title: string;
      videoUrl: string;
    }>;

    return parsed.map(video => ({
      ...video,
      createdAt: new Date(resolveLegacyVideoCreatedAtTimestamp(video)),
    }));
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
};
