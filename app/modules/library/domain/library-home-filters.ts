export interface LibraryHomeFiltersInput {
  rawQuery?: string | null;
  rawTags?: string[];
}

export interface LibraryHomeFilters {
  displayQuery: string;
  normalizedQuery: string;
  rawTags: string[];
  normalizedTags: string[];
}

function isNonEmptyRawTag(tag: string) {
  return tag.trim().length > 0;
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

export function createLibraryHomeFilters(input: LibraryHomeFiltersInput): LibraryHomeFilters {
  const displayQuery = input.rawQuery ?? '';
  const rawTags = (input.rawTags ?? []).filter(isNonEmptyRawTag);
  const normalizedQuery = displayQuery.trim().toLowerCase();
  const normalizedTags = rawTags.map(normalizeTag);

  return {
    displayQuery,
    normalizedQuery,
    rawTags,
    normalizedTags,
  };
}
