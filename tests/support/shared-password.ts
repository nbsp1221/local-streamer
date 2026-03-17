import { normalizeSharedPassword } from '../../app/shared/lib/normalize-shared-password';

export const DEFAULT_E2E_SHARED_PASSWORD = '1q2w3e4r!qwerty';

export function getE2ESharedPassword(rawValue?: string): string {
  return normalizeSharedPassword(rawValue) ?? DEFAULT_E2E_SHARED_PASSWORD;
}
