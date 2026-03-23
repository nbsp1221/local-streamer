import path from 'node:path';
import type { VideoRepository, CreateVideoInput, UpdateVideoInput } from './interfaces/VideoRepository';
import type { Video } from '~/legacy/types/video';
import { JsonVideoRepository } from './JsonVideoRepository';
import { getVideoMetadataConfig } from '~/shared/config/video-metadata.server';
import { SqliteLibraryVideoMetadataRepository } from '~/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository';

interface SqliteVideoRepositoryOptions {
  bootstrapRepository?: VideoRepository;
  dbPath?: string;
  metadataRepository?: SqliteLibraryVideoMetadataRepository;
}

export class SqliteVideoRepository implements VideoRepository {
  private bootstrapPromise: Promise<void> | null = null;
  private readonly bootstrapRepository: VideoRepository;
  private readonly metadataRepository: SqliteLibraryVideoMetadataRepository;

  constructor(options: SqliteVideoRepositoryOptions = {}) {
    this.bootstrapRepository = options.bootstrapRepository ?? createDefaultBootstrapRepository();
    this.metadataRepository = options.metadataRepository ?? new SqliteLibraryVideoMetadataRepository({
      dbPath: options.dbPath ?? getVideoMetadataConfig().sqlitePath,
    });
  }

  private async ensureBootstrapped(): Promise<void> {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = (async () => {
        const bootstrapComplete = await this.metadataRepository.isBootstrapComplete();

        if (bootstrapComplete) {
          return;
        }

        const legacyVideos = await this.bootstrapRepository.findAll();

        await this.metadataRepository.bootstrapFromVideos(legacyVideos);
      })().catch((error) => {
        this.bootstrapPromise = null;
        throw error;
      });
    }

    return this.bootstrapPromise;
  }

  async count(): Promise<number> {
    await this.ensureBootstrapped();
    return this.metadataRepository.count();
  }

  async create(input: CreateVideoInput): Promise<Video> {
    await this.ensureBootstrapped();

    return this.metadataRepository.create({
      description: input.description,
      duration: input.duration,
      id: input.id,
      tags: input.tags,
      thumbnailUrl: input.thumbnailUrl,
      title: input.title,
      videoUrl: input.videoUrl,
    });
  }

  async delete(id: string): Promise<boolean> {
    await this.ensureBootstrapped();
    return this.metadataRepository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    await this.ensureBootstrapped();
    return this.metadataRepository.exists(id);
  }

  async findAll(): Promise<Video[]> {
    await this.ensureBootstrapped();
    return this.metadataRepository.findAll();
  }

  async findById(id: string): Promise<Video | null> {
    await this.ensureBootstrapped();
    return this.metadataRepository.findById(id);
  }

  async findByTag(tag: string): Promise<Video[]> {
    await this.ensureBootstrapped();
    return this.metadataRepository.findByTag(tag);
  }

  async findByTitle(title: string): Promise<Video[]> {
    await this.ensureBootstrapped();
    return this.metadataRepository.findByTitle(title);
  }

  async getAllTags(): Promise<string[]> {
    await this.ensureBootstrapped();
    return this.metadataRepository.getAllTags();
  }

  async search(query: string): Promise<Video[]> {
    await this.ensureBootstrapped();
    return this.metadataRepository.search(query);
  }

  async update(id: string, updates: UpdateVideoInput): Promise<Video | null> {
    await this.ensureBootstrapped();
    return this.metadataRepository.update(id, updates);
  }
}

function createDefaultBootstrapRepository(): VideoRepository {
  const storageDir = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.join(process.cwd(), 'storage');
  const bootstrapVideoPath = path.join(storageDir, 'data', 'videos.json');

  return new (class extends JsonVideoRepository {
    protected readonly filePath = bootstrapVideoPath;
  })();
}
