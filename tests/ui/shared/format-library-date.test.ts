import { describe, expect, test } from 'vitest';

import { formatLibraryDate } from '../../../app/shared/lib/format-library-date';

describe('formatLibraryDate', () => {
  test('formats a UTC library date deterministically from Date and ISO string inputs', () => {
    const isoDate = '2026-03-11T00:00:00.000Z';

    expect(formatLibraryDate(new Date(isoDate))).toBe('3/11/2026');
    expect(formatLibraryDate(isoDate)).toBe('3/11/2026');
  });
});
