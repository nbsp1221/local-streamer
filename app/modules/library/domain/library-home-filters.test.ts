import { describe, expect, test } from 'vitest';
import { createLibraryHomeFilters } from './library-home-filters';

describe('createLibraryHomeFilters', () => {
  test('preserves display query text while normalizing a trimmed lowercase query for matching', () => {
    const filters = createLibraryHomeFilters({
      rawQuery: '  MiXeD Case Query  ',
      rawTags: [],
    });

    expect(filters.displayQuery).toBe('  MiXeD Case Query  ');
    expect(filters.normalizedQuery).toBe('mixed case query');
  });

  test('removes empty raw tags and preserves repeated non-empty raw tags in bootstrap order', () => {
    const filters = createLibraryHomeFilters({
      rawQuery: '',
      rawTags: ['', 'Action', ' ', 'Action', 'Drama'],
    });

    expect(filters.rawTags).toEqual(['Action', 'Action', 'Drama']);
    expect(filters.normalizedTags).toEqual(['action', 'action', 'drama']);
  });

  test('normalizes tag data without mutating the raw bootstrap tags', () => {
    const filters = createLibraryHomeFilters({
      rawQuery: '',
      rawTags: ['  Neo Noir  ', 'SCI-FI'],
    });

    expect(filters.rawTags).toEqual(['  Neo Noir  ', 'SCI-FI']);
    expect(filters.normalizedTags).toEqual(['neo noir', 'sci-fi']);
  });
});
