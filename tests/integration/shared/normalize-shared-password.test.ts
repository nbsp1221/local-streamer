import { describe, expect, test } from 'vitest';
import { normalizeSharedPassword } from '../../../app/shared/lib/normalize-shared-password';

describe('normalizeSharedPassword', () => {
  test('trims surrounding whitespace from a configured shared password', () => {
    expect(normalizeSharedPassword('  vault-password \n')).toBe('vault-password');
  });

  test('returns undefined when the configured value is blank after trimming', () => {
    expect(normalizeSharedPassword('   \n\t')).toBeUndefined();
    expect(normalizeSharedPassword(undefined)).toBeUndefined();
  });
});
