const DEFAULT_E2E_SHARED_PASSWORD = '1q2w3e4r!qwerty';

export function getE2ESharedPassword(rawValue = process.env.AUTH_SHARED_PASSWORD): string {
  const normalizedValue = rawValue?.trim();
  return normalizedValue && normalizedValue.length > 0
    ? normalizedValue
    : DEFAULT_E2E_SHARED_PASSWORD;
}
