import type { LibraryVideoMutationPort } from '~/modules/library/application/ports/library-video-mutation.port';
import { getVideoMetadataConfig } from '~/shared/config/video-metadata.server';
import { type ReadBootstrapLibraryVideos, createLibraryVideoMetadataBootstrapGuard, readBootstrapLibraryVideos } from './bootstrap-library-video-metadata';
import { SqliteLibraryVideoMetadataRepository } from './sqlite-library-video-metadata.repository';

type SqliteLibraryVideoMutationAdapterRepository = Pick<
  SqliteLibraryVideoMetadataRepository,
  'delete' | 'findById' | 'update'
> & Partial<Pick<SqliteLibraryVideoMetadataRepository, 'bootstrapFromVideos' | 'isBootstrapComplete'>>;

interface SqliteLibraryVideoMutationAdapterDependencies {
  bootstrapKey?: string;
  readBootstrapVideos?: ReadBootstrapLibraryVideos;
  repository?: SqliteLibraryVideoMutationAdapterRepository;
}

function isBootstrapAwareRepository(
  repository: SqliteLibraryVideoMutationAdapterRepository,
): repository is SqliteLibraryVideoMutationAdapterRepository & Pick<SqliteLibraryVideoMetadataRepository, 'bootstrapFromVideos' | 'isBootstrapComplete'> {
  return typeof repository.bootstrapFromVideos === 'function' &&
    typeof repository.isBootstrapComplete === 'function';
}

export class SqliteLibraryVideoMutationAdapter implements LibraryVideoMutationPort {
  private readonly ensureBootstrapped: () => Promise<void>;
  private readonly repository: SqliteLibraryVideoMutationAdapterRepository;

  constructor(deps: SqliteLibraryVideoMutationAdapterDependencies = {}) {
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

  async deleteLibraryVideo({ videoId }: { videoId: string }) {
    await this.ensureBootstrapped();
    const existingVideo = await this.repository.findById(videoId);

    if (!existingVideo) {
      return { deleted: false };
    }

    const deleted = await this.repository.delete(videoId);

    if (!deleted) {
      return { deleted: false, title: existingVideo.title };
    }

    return {
      deleted: true,
      title: existingVideo.title,
    };
  }

  async findLibraryVideoById(videoId: string) {
    await this.ensureBootstrapped();
    return this.repository.findById(videoId);
  }

  async updateLibraryVideo(input: Parameters<LibraryVideoMutationPort['updateLibraryVideo']>[0]) {
    await this.ensureBootstrapped();
    return this.repository.update(input.videoId, {
      description: input.description,
      tags: input.tags,
      title: input.title,
    });
  }
}
