import { describe, expect, test } from 'vitest';
import { formatDisplayDate } from '../../../app/shared/lib/format-display-date';

describe('formatDisplayDate', () => {
  test('formats a display date using the runtime local timezone semantics', () => {
    const isoDate = '2026-03-08T00:00:00.000Z';
    const expected = new Intl.DateTimeFormat('en-US').format(new Date(isoDate));

    expect(formatDisplayDate(new Date(isoDate))).toBe(expected);
    expect(formatDisplayDate(isoDate)).toBe(expected);
  });

  test('uses the same local-time semantics for daylight-saving-season timestamps', () => {
    const isoDate = '2026-06-01T07:30:00.000Z';
    const expected = new Intl.DateTimeFormat('en-US').format(new Date(isoDate));

    expect(formatDisplayDate(new Date(isoDate))).toBe(expected);
    expect(formatDisplayDate(isoDate)).toBe(expected);
  });
});
