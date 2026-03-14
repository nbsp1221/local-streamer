import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const libraryRoot = join(process.cwd(), 'app/modules/library');
const forbiddenImportPatterns = [
  /(?:from|import\s*\(|require\s*\()\s*['"]~\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]app\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/\.\.\/legacy(?:\/|['"])/,
];

async function collectLibraryFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectLibraryFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  }));

  return files.flat();
}

describe('library module boundary', () => {
  test('does not import app/legacy from within app/modules/library', async () => {
    const files = await collectLibraryFiles(libraryRoot);

    for (const filePath of files) {
      const source = await readFile(filePath, 'utf8');
      const hasForbiddenImport = forbiddenImportPatterns.some(pattern => pattern.test(source));

      expect(hasForbiddenImport, `Forbidden legacy import found in ${relative(process.cwd(), filePath)}`).toBe(false);
    }
  });
});
