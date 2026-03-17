export function normalizeSharedPassword(rawValue?: string): string | undefined {
  const normalizedValue = rawValue?.trim();
  return normalizedValue && normalizedValue.length > 0
    ? normalizedValue
    : undefined;
}
