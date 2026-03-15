import { describe, expect, test } from 'vitest';
import { getE2ESharedPassword } from '../../e2e/support/shared-password';

describe('getE2ESharedPassword', () => {
  test('trims surrounding whitespace from the configured shared password', () => {
    expect(getE2ESharedPassword('  vault-password \n')).toBe('vault-password');
  });

  test('falls back to the default password when the configured value is blank after trimming', () => {
    expect(getE2ESharedPassword('   \n\t')).toBe('1q2w3e4r!qwerty');
  });
});
