import { normalizeVideoTag, normalizeVideoTags } from './video-tag';

export interface VideoTaxonomyItem {
  active: boolean;
  label: string;
  slug: string;
  sortOrder: number;
}

export const DEFAULT_VIDEO_CONTENT_TYPES: VideoTaxonomyItem[] = [
  { active: true, label: 'Movie', slug: 'movie', sortOrder: 10 },
  { active: true, label: 'Episode', slug: 'episode', sortOrder: 20 },
  { active: true, label: 'Home video', slug: 'home_video', sortOrder: 30 },
  { active: true, label: 'Clip', slug: 'clip', sortOrder: 40 },
  { active: true, label: 'Other', slug: 'other', sortOrder: 50 },
];

export const DEFAULT_VIDEO_GENRES: VideoTaxonomyItem[] = [
  { active: true, label: 'Action', slug: 'action', sortOrder: 10 },
  { active: true, label: 'Drama', slug: 'drama', sortOrder: 20 },
  { active: true, label: 'Comedy', slug: 'comedy', sortOrder: 30 },
  { active: true, label: 'Documentary', slug: 'documentary', sortOrder: 40 },
  { active: true, label: 'Animation', slug: 'animation', sortOrder: 50 },
  { active: true, label: 'Other', slug: 'other', sortOrder: 60 },
];

export function normalizeTaxonomySlug(rawSlug: string): string | null {
  return normalizeVideoTag(rawSlug);
}

export function normalizeTaxonomySlugs(rawSlugs: string[]): string[] {
  return normalizeVideoTags(rawSlugs);
}
