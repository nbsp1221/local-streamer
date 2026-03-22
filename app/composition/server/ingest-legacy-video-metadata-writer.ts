import type { VideoRepository } from '~/legacy/repositories/interfaces/VideoRepository';
import type { IngestVideoMetadataWriterPort } from '~/modules/ingest/application/ports/ingest-video-metadata-writer.port';
import { getVideoRepository } from '~/legacy/repositories';

interface IngestLegacyVideoMetadataWriterDependencies {
  videoRepository: VideoRepository;
}

export function createIngestLegacyVideoMetadataWriter(
  overrides: Partial<IngestLegacyVideoMetadataWriterDependencies> = {},
): IngestVideoMetadataWriterPort {
  const videoRepository = overrides.videoRepository ?? getVideoRepository();

  return {
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
