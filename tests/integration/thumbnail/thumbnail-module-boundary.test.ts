import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const thumbnailRoot = join(process.cwd(), 'app/modules/thumbnail');
const allowedLegacyImportFiles = new Set([
  join(
    thumbnailRoot,
    'infrastructure/decryption/legacy-thumbnail-decryption.service.adapter.ts',
  ),
]);
const forbiddenImportPatterns = [
  /(?:from|import\s*\(|require\s*\()\s*['"]~\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]app\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/\.\.\/legacy(?:\/|['"])/,
];

async function collectThumbnailFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectThumbnailFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  }));

  return files.flat();
}

describe('thumbnail module boundary', () => {
  test('isolates legacy imports to the approved thumbnail compatibility seam', async () => {
    const files = await collectThumbnailFiles(thumbnailRoot);

    for (const filePath of files) {
      if (allowedLegacyImportFiles.has(filePath)) {
        continue;
      }

      const source = await readFile(filePath, 'utf8');
      const hasForbiddenImport = forbiddenImportPatterns.some(pattern => pattern.test(source));

      expect(
        hasForbiddenImport,
        `Forbidden legacy import found in ${relative(process.cwd(), filePath)}`,
      ).toBe(false);
    }
  });
});
