import { describe, expect, test } from 'vitest';
import {
  createBunVersionMismatchMessage,
  getRequiredBunVersion,
  verifyBunVersion,
} from '../../../scripts/verify-bun-version';

describe('verifyBunVersion', () => {
  test('reads the repo Bun contract from packageManager', () => {
    expect(getRequiredBunVersion({
      packageManager: 'bun@1.3.5',
    })).toBe('1.3.5');
  });

  test('returns a mismatch result when the running Bun version differs from packageManager', () => {
    expect(verifyBunVersion({
      currentVersion: '1.2.17',
      packageJson: {
        packageManager: 'bun@1.3.5',
      },
    })).toEqual({
      currentVersion: '1.2.17',
      ok: false,
      requiredVersion: '1.3.5',
    });
  });

  test('formats a fail-fast mismatch message with the current and required versions', () => {
    expect(createBunVersionMismatchMessage({
      currentVersion: '1.2.17',
      requiredVersion: '1.3.5',
    })).toContain('Current Bun: 1.2.17');
    expect(createBunVersionMismatchMessage({
      currentVersion: '1.2.17',
      requiredVersion: '1.3.5',
    })).toContain('Required Bun: 1.3.5');
  });
});
