export interface HomeLibraryFilters {
  query: string;
  tags: string[];
}

export function createHomeLibraryFilters(initialFilters?: Partial<HomeLibraryFilters>): HomeLibraryFilters {
  return {
    query: initialFilters?.query ?? '',
    tags: normalizeBootstrapTags(initialFilters?.tags ?? []),
  };
}

function normalizeBootstrapTags(tags: string[]) {
  const seenTags = new Set<string>();

  return tags.reduce<string[]>((acc, rawTag) => {
    const tag = rawTag.trim();

    if (tag.length === 0) {
      return acc;
    }

    const normalizedTag = tag.toLowerCase();

    if (seenTags.has(normalizedTag)) {
      return acc;
    }

    seenTags.add(normalizedTag);
    acc.push(tag);
    return acc;
  }, []);
}

export function normalizeHomeLibraryQuery(query: string) {
  return query.trim().toLowerCase();
}

export function normalizeHomeLibraryTags(tags: string[]) {
  return [...tags].map(tag => tag.toLowerCase()).sort();
}

export function areHomeLibraryTagsEquivalent(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

export function areHomeLibraryFiltersEqual(a: HomeLibraryFilters, b: HomeLibraryFilters) {
  if (normalizeHomeLibraryQuery(a.query) !== normalizeHomeLibraryQuery(b.query)) {
    return false;
  }

  const aTags = normalizeHomeLibraryTags(a.tags);
  const bTags = normalizeHomeLibraryTags(b.tags);

  if (aTags.length !== bTags.length) {
    return false;
  }

  return aTags.every((tag, index) => tag === bTags[index]);
}

export function toggleHomeLibraryTag(tags: string[], tag: string) {
  return tags.some(existing => areHomeLibraryTagsEquivalent(existing, tag))
    ? tags.filter(existing => !areHomeLibraryTagsEquivalent(existing, tag))
    : [...tags, tag];
}
