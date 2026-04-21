import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const projectRoot = process.cwd();
const files = [
  join(projectRoot, 'app/routes/_index.tsx'),
  join(projectRoot, 'app/composition/server/home-library-page.ts'),
];
const forbiddenImportPatterns = [
  /(?:from|import\s*\(|require\s*\()\s*['"]~\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]app\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/legacy(?:\/|['"])/,
];

describe('home read route ownership boundary', () => {
  test('active home route and page composition do not import app/legacy directly', async () => {
    for (const filePath of files) {
      const source = await readFile(filePath, 'utf8');
      const hasForbiddenImport = forbiddenImportPatterns.some(pattern => pattern.test(source));

      expect(
        hasForbiddenImport,
        `Forbidden legacy import found in ${relative(projectRoot, filePath)}`,
      ).toBe(false);
    }
  });

  test('home page composition does not depend on the retired home pending-upload seam', async () => {
    const filePath = join(projectRoot, 'app/composition/server/home-library-page.ts');
    const source = await readFile(filePath, 'utf8');

    expect(
      source.includes('./home-legacy-pending-video-source'),
      'home-library-page.ts should not import the retired home pending seam',
    ).toBe(false);
  });
});
