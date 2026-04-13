import type { IngestVideoMetadataWriterPort } from '~/modules/ingest/application/ports/ingest-video-metadata-writer.port';
import type { LibraryVideoSourcePort } from '~/modules/library/application/ports/library-video-source.port';
import { getVideoMetadataConfig } from '~/shared/config/video-metadata.server';
import { type ReadBootstrapLibraryVideos, createLibraryVideoMetadataBootstrapGuard, readBootstrapLibraryVideos } from './bootstrap-library-video-metadata';
import { SqliteLibraryVideoMetadataRepository } from './sqlite-library-video-metadata.repository';

type SqliteCanonicalVideoMetadataAdapterRepository = Pick<
  SqliteLibraryVideoMetadataRepository,
  'create' | 'findAll'
> & Partial<Pick<SqliteLibraryVideoMetadataRepository, 'bootstrapFromVideos' | 'isBootstrapComplete'>>;

interface SqliteCanonicalVideoMetadataAdapterDependencies {
  bootstrapKey?: string;
  readBootstrapVideos?: ReadBootstrapLibraryVideos;
  repository?: SqliteCanonicalVideoMetadataAdapterRepository;
}

function isBootstrapAwareRepository(
  repository: SqliteCanonicalVideoMetadataAdapterRepository,
): repository is SqliteCanonicalVideoMetadataAdapterRepository & Pick<SqliteLibraryVideoMetadataRepository, 'bootstrapFromVideos' | 'isBootstrapComplete'> {
  return typeof repository.bootstrapFromVideos === 'function' &&
    typeof repository.isBootstrapComplete === 'function';
}

export class SqliteCanonicalVideoMetadataAdapter
implements LibraryVideoSourcePort, IngestVideoMetadataWriterPort {
  private readonly ensureBootstrapped: () => Promise<void>;
  private readonly repository: SqliteCanonicalVideoMetadataAdapterRepository;

  constructor(deps: SqliteCanonicalVideoMetadataAdapterDependencies = {}) {
    const repository = deps.repository ?? new SqliteLibraryVideoMetadataRepository({
      dbPath: getVideoMetadataConfig().sqlitePath,
    });

    this.repository = repository;
    this.ensureBootstrapped = isBootstrapAwareRepository(repository)
      ? createLibraryVideoMetadataBootstrapGuard({
          bootstrapKey: deps.bootstrapKey ?? getVideoMetadataConfig().sqlitePath,
          readBootstrapVideos: deps.readBootstrapVideos ?? readBootstrapLibraryVideos,
          repository,
        })
      : async () => {};
  }

  async listLibraryVideos() {
    await this.ensureBootstrapped();
    return this.repository.findAll();
  }

  async writeVideoRecord(record: Parameters<IngestVideoMetadataWriterPort['writeVideoRecord']>[0]) {
    await this.ensureBootstrapped();
    await this.repository.create({
      description: record.description,
      duration: record.duration,
      id: record.id,
      tags: record.tags,
      thumbnailUrl: record.thumbnailUrl,
      title: record.title,
      videoUrl: record.videoUrl,
    });
  }
}
