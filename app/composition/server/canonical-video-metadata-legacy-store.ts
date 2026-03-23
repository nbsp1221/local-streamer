import type { VideoRepository } from '~/legacy/repositories/interfaces/VideoRepository';
import type { IngestVideoMetadataWriterPort } from '~/modules/ingest/application/ports/ingest-video-metadata-writer.port';
import type { LibraryVideoSourcePort } from '~/modules/library/application/ports/library-video-source.port';
import { getVideoRepository } from '~/legacy/repositories';

interface CanonicalVideoMetadataLegacyStoreDependencies {
  videoRepository: VideoRepository;
}

export interface CanonicalVideoMetadataLegacyStore
  extends LibraryVideoSourcePort, IngestVideoMetadataWriterPort {}

export function createCanonicalVideoMetadataLegacyStore(
  overrides: Partial<CanonicalVideoMetadataLegacyStoreDependencies> = {},
): CanonicalVideoMetadataLegacyStore {
  const videoRepository = overrides.videoRepository ?? getVideoRepository();

  return {
    listLibraryVideos() {
      return videoRepository.findAll();
    },
    async writeVideoRecord(record) {
      await videoRepository.create({
        description: record.description,
        duration: record.duration,
        id: record.id,
        tags: record.tags,
        thumbnailUrl: record.thumbnailUrl,
        title: record.title,
        videoUrl: record.videoUrl,
      });
    },
  };
}
