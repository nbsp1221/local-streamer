import { normalizeVideoTags } from '~/modules/library/domain/video-tag';
import { normalizeTaxonomySlug, normalizeTaxonomySlugs } from '~/modules/library/domain/video-taxonomy';
import { SqliteLibraryVideoMetadataRepository } from '~/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository';

export interface SeedLibraryVideoInput {
  addedAt?: string;
  createdAt?: Date | string;
  description?: string;
  duration: number;
  contentTypeSlug?: string;
  genreSlugs?: string[];
  id: string;
  tags?: string[];
  thumbnailUrl?: string;
  title: string;
  videoUrl: string;
}

function resolveCreatedAt(input: Pick<SeedLibraryVideoInput, 'addedAt' | 'createdAt'>) {
  const rawTimestamp = input.createdAt instanceof Date
    ? input.createdAt.toISOString()
    : input.createdAt || input.addedAt;

  return new Date(rawTimestamp || 0);
}

export async function seedLibraryVideoMetadata(
  dbPath: string,
  videos: SeedLibraryVideoInput[],
): Promise<void> {
  const repository = new SqliteLibraryVideoMetadataRepository({ dbPath });
  const existingVideos = await repository.findAll();
  const existingIds = new Set(existingVideos.map(video => video.id));
  let sortIndex = existingVideos.length + videos.length;

  for (const video of videos) {
    if (existingIds.has(video.id)) {
      continue;
    }

    await repository.create({
      createdAt: resolveCreatedAt(video),
      description: video.description,
      duration: video.duration,
      contentTypeSlug: video.contentTypeSlug ? normalizeTaxonomySlug(video.contentTypeSlug) ?? undefined : undefined,
      genreSlugs: normalizeTaxonomySlugs(video.genreSlugs ?? []),
      id: video.id,
      sortIndex,
      tags: normalizeVideoTags(video.tags ?? []),
      thumbnailUrl: video.thumbnailUrl,
      title: video.title,
      videoUrl: video.videoUrl,
    });
    sortIndex -= 1;
    existingIds.add(video.id);
  }
}
