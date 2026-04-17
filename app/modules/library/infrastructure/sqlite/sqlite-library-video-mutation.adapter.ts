import type { LibraryVideoMutationPort } from '~/modules/library/application/ports/library-video-mutation.port';
import { getVideoMetadataConfig } from '~/shared/config/video-metadata.server';
import { SqliteLibraryVideoMetadataRepository } from './sqlite-library-video-metadata.repository';

type SqliteLibraryVideoMutationAdapterRepository = Pick<
  SqliteLibraryVideoMetadataRepository,
  'delete' | 'findById' | 'update'
>;

interface SqliteLibraryVideoMutationAdapterDependencies {
  repository?: SqliteLibraryVideoMutationAdapterRepository;
}

export class SqliteLibraryVideoMutationAdapter implements LibraryVideoMutationPort {
  private readonly repository: SqliteLibraryVideoMutationAdapterRepository;

  constructor(deps: SqliteLibraryVideoMutationAdapterDependencies = {}) {
    this.repository = deps.repository ?? new SqliteLibraryVideoMetadataRepository({
      dbPath: getVideoMetadataConfig().sqlitePath,
    });
  }

  async deleteLibraryVideo({ videoId }: { videoId: string }) {
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
    return this.repository.findById(videoId);
  }

  async updateLibraryVideo(input: Parameters<LibraryVideoMutationPort['updateLibraryVideo']>[0]) {
    return this.repository.update(input.videoId, {
      description: input.description,
      tags: input.tags,
      title: input.title,
    });
  }
}
