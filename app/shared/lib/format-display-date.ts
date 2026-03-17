const DISPLAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US');

export function formatDisplayDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return DISPLAY_DATE_FORMATTER.format(date);
}
