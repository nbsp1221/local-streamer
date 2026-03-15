const LIBRARY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
});

export function formatLibraryDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return LIBRARY_DATE_FORMATTER.format(date);
}
