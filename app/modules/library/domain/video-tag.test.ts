import { describe, expect, test } from 'vitest';
import {
  formatVideoTagLabel,
  normalizeVideoTag,
  normalizeVideoTags,
} from './video-tag';

describe('video tag helpers', () => {
  test('normalizes tags into canonical storage values', () => {
    expect(normalizeVideoTag('magic')).toBe('magic');
    expect(normalizeVideoTag('Good Boy-comedy')).toBe('good_boy-comedy');
    expect(normalizeVideoTag('  Mixed   Case 123  ')).toBe('mixed_case_123');
  });

  test('removes unsupported characters and drops empty normalized tags', () => {
    expect(normalizeVideoTag('Good/Boy!')).toBe('goodboy');
    expect(normalizeVideoTag('!!!')).toBeNull();
  });

  test('normalizes underscore separators only when surrounded by letters or numbers', () => {
    expect(normalizeVideoTag('_good_')).toBe('good');
    expect(normalizeVideoTag('good__boy')).toBe('good_boy');
    expect(normalizeVideoTag('good - boy')).toBe('good-boy');
  });

  test('drops separator-only tags because they render as blank or meaningless labels', () => {
    expect(normalizeVideoTag('_')).toBeNull();
    expect(normalizeVideoTag('__')).toBeNull();
    expect(normalizeVideoTag('___')).toBeNull();
    expect(normalizeVideoTag('--')).toBeNull();
    expect(normalizeVideoTag('----')).toBeNull();
    expect(normalizeVideoTags(['valid', '___', '----', 'also_valid'])).toEqual(['valid', 'also_valid']);
  });

  test('deduplicates tags by canonical value while preserving first-seen order', () => {
    expect(normalizeVideoTags([
      'Magic',
      'magic',
      'Good Boy-comedy',
      'good_boy-comedy',
      '  ',
    ])).toEqual(['magic', 'good_boy-comedy']);
  });

  test('derives display labels from canonical values without changing hyphens', () => {
    expect(formatVideoTagLabel('good_boy-comedy')).toBe('good boy-comedy');
  });
});
