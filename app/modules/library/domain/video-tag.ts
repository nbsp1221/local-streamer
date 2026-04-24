const TAG_ALLOWED_CHARACTERS_PATTERN = /[^a-z0-9_-]/g;
const TAG_WHITESPACE_PATTERN = /\s+/g;

export function normalizeVideoTag(rawTag: string): string | null {
  const normalizedTag = rawTag
    .trim()
    .toLowerCase()
    .replace(TAG_WHITESPACE_PATTERN, '_')
    .replace(TAG_ALLOWED_CHARACTERS_PATTERN, '');

  return normalizedTag.length > 0 ? normalizedTag : null;
}

export function normalizeVideoTags(rawTags: string[]): string[] {
  const seenTags = new Set<string>();
  const normalizedTags: string[] = [];

  for (const rawTag of rawTags) {
    const tag = normalizeVideoTag(rawTag);

    if (!tag || seenTags.has(tag)) {
      continue;
    }

    seenTags.add(tag);
    normalizedTags.push(tag);
  }

  return normalizedTags;
}

export function formatVideoTagLabel(tag: string): string {
  return tag.replaceAll('_', ' ');
}
