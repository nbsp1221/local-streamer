import { describe, expect, test } from 'vitest';
import { getE2ESharedPassword } from '../../support/shared-password';

describe('getE2ESharedPassword', () => {
  test('trims surrounding whitespace from the configured shared password', () => {
    expect(getE2ESharedPassword('  vault-password \n')).toBe('vault-password');
  });

  test('falls back to the default password when the configured value is blank after trimming', () => {
    expect(getE2ESharedPassword('   \n\t')).toBe('1q2w3e4r!qwerty');
  });

  test('does not read the ambient AUTH_SHARED_PASSWORD by default', () => {
    const originalValue = process.env.AUTH_SHARED_PASSWORD;
    process.env.AUTH_SHARED_PASSWORD = 'ambient-password';

    try {
      expect(getE2ESharedPassword()).toBe('1q2w3e4r!qwerty');
    }
    finally {
      if (originalValue === undefined) {
        delete process.env.AUTH_SHARED_PASSWORD;
      }
      else {
        process.env.AUTH_SHARED_PASSWORD = originalValue;
      }
    }
  });
});
