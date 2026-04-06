import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SqliteLibraryVideoMetadataRepository } from '~/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository';
import { getVideoMetadataConfig } from '~/shared/config/video-metadata.server';
import type { VideoCatalogPort } from '../../application/ports/video-catalog.port';

interface PlaybackVideoCatalogRepositoryRecord {
  createdAt: Date;
  description?: string;
  duration: number;
  id: string;
  tags: string[];
  thumbnailUrl?: string;
  title: string;
  videoUrl: string;
}

interface PlaybackVideoCatalogRepository {
  findAll: () => Promise<PlaybackVideoCatalogRepositoryRecord[]>;
}

interface PlaybackVideoCatalogAdapterDependencies {
  repository?: PlaybackVideoCatalogRepository;
}

export class PlaybackVideoCatalogAdapter implements VideoCatalogPort {
  private readonly metadataRepository: SqliteLibraryVideoMetadataRepository | null;
  private readonly repository: PlaybackVideoCatalogRepository;
  private bootstrapPromise: Promise<void> | null = null;

  constructor(deps: PlaybackVideoCatalogAdapterDependencies = {}) {
    if (deps.repository) {
      this.metadataRepository = null;
      this.repository = deps.repository;
      return;
    }

    this.metadataRepository = new SqliteLibraryVideoMetadataRepository({
      dbPath: getVideoMetadataConfig().sqlitePath,
    });
    this.repository = this.metadataRepository;
  }

  async getPlayerVideo(videoId: string) {
    await this.ensureBootstrapped();

    const videos = await this.repository.findAll();
    const currentVideo = videos.find(video => video.id === videoId);

    if (!currentVideo) {
      return null;
    }

    return {
      relatedVideos: findRelatedVideos(currentVideo, videos),
      video: currentVideo,
    };
  }

  private async ensureBootstrapped() {
    if (!this.metadataRepository) {
      return;
    }

    if (!this.bootstrapPromise) {
      this.bootstrapPromise = (async () => {
        const bootstrapComplete = await this.metadataRepository!.isBootstrapComplete();

        if (bootstrapComplete) {
          return;
        }

        const legacyVideos = await readBootstrapVideosJson();
        await this.metadataRepository!.bootstrapFromVideos(legacyVideos);
      })().catch((error) => {
        this.bootstrapPromise = null;
        throw error;
      });
    }

    await this.bootstrapPromise;
  }
}

function findRelatedVideos(
  current: PlaybackVideoCatalogRepositoryRecord,
  allVideos: PlaybackVideoCatalogRepositoryRecord[],
) {
  if (current.tags.length === 0) {
    return [];
  }

  const currentTags = new Set(current.tags.map(tag => tag.toLowerCase()));

  return allVideos
    .filter(candidate => candidate.id !== current.id)
    .filter(candidate => candidate.tags.some(tag => currentTags.has(tag.toLowerCase())))
    .slice(0, 10);
}

function resolveLegacyVideoCreatedAtTimestamp(video: {
  addedAt?: string;
  createdAt?: string;
}) {
  return video.createdAt || video.addedAt || 0;
}

async function readBootstrapVideosJson(): Promise<PlaybackVideoCatalogRepositoryRecord[]> {
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
}
