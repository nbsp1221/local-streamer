import type { IngestVideoMetadataWriterPort } from '~/modules/ingest/application/ports/ingest-video-metadata-writer.port';
import type { LibraryVideoSourcePort } from '~/modules/library/application/ports/library-video-source.port';
import { getVideoMetadataConfig } from '~/shared/config/video-metadata.server';
import { SqliteLibraryVideoMetadataRepository } from './sqlite-library-video-metadata.repository';

type SqliteCanonicalVideoMetadataAdapterRepository = Pick<
  SqliteLibraryVideoMetadataRepository,
  'create' | 'findAll' | 'listActiveContentTypes' | 'listActiveGenres'
>;

interface SqliteCanonicalVideoMetadataAdapterDependencies {
  repository?: SqliteCanonicalVideoMetadataAdapterRepository;
}

export class SqliteCanonicalVideoMetadataAdapter
implements LibraryVideoSourcePort, IngestVideoMetadataWriterPort {
  private readonly repository: SqliteCanonicalVideoMetadataAdapterRepository;

  constructor(deps: SqliteCanonicalVideoMetadataAdapterDependencies = {}) {
    this.repository = deps.repository ?? new SqliteLibraryVideoMetadataRepository({
      dbPath: getVideoMetadataConfig().sqlitePath,
    });
  }

  async listLibraryVideos() {
    return this.repository.findAll();
  }

  async listActiveContentTypes() {
    return this.repository.listActiveContentTypes();
  }

  async listActiveGenres() {
    return this.repository.listActiveGenres();
  }

  async writeVideoRecord(record: Parameters<IngestVideoMetadataWriterPort['writeVideoRecord']>[0]) {
    await this.repository.create({
      contentTypeSlug: record.contentTypeSlug,
      description: record.description,
      duration: record.duration,
      genreSlugs: record.genreSlugs,
      id: record.id,
      tags: record.tags,
      thumbnailUrl: record.thumbnailUrl,
      title: record.title,
      videoUrl: record.videoUrl,
    });
  }
}
