import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const PROJECT_ROOT = resolve(__dirname, '../../..');
const TEST_GLOBS = [
  'tests/ui/home/**/*.test.tsx',
  'tests/integration/library/home-*.test.ts',
  'tests/e2e/home-*.spec.ts',
];

function includesLegacyImport(source: string) {
  return source.includes('~/legacy/') ||
    source.includes('\'../../../app/legacy/') ||
    source.includes('"../../../app/legacy/') ||
    source.includes('\'../../app/legacy/') ||
    source.includes('"../../app/legacy/') ||
    source.includes('\'../app/legacy/') ||
    source.includes('"../app/legacy/');
}

describe('home test boundary', () => {
  test('active home tests do not import app/legacy', async () => {
    const files = (
      await Promise.all(
        TEST_GLOBS.map(async pattern => Array.fromAsync(glob(pattern, { cwd: PROJECT_ROOT }))),
      )
    ).flat();

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      if (file.endsWith('tests/integration/library/home-test-boundary.test.ts')) {
        continue;
      }

      const source = await readFile(resolve(PROJECT_ROOT, file), 'utf8');
      expect(includesLegacyImport(source), file).toBe(false);
    }
  });

  test('active home tests do not depend on screenshot baselines', async () => {
    const files = (
      await Promise.all(
        TEST_GLOBS.map(async pattern => Array.fromAsync(glob(pattern, { cwd: PROJECT_ROOT }))),
      )
    ).flat();

    expect(files.length).toBeGreaterThan(0);
    expect(files).not.toContain('tests/e2e/home-ui-parity.spec.ts');

    for (const file of files) {
      if (file.endsWith('tests/integration/library/home-test-boundary.test.ts')) {
        continue;
      }

      const source = await readFile(resolve(PROJECT_ROOT, file), 'utf8');
      expect(source.includes('toHaveScreenshot('), file).toBe(false);
    }
  });
});
