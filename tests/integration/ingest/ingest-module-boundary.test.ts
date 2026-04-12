import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const ingestRoot = join(process.cwd(), 'app/modules/ingest');
const allowedLegacyImportFiles = new Set([
  join(
    ingestRoot,
    'infrastructure/processing/ffmpeg-ingest-video-processing.adapter.ts',
  ),
]);
const forbiddenImportPatterns = [
  /(?:from|import\s*\(|require\s*\()\s*['"]~\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]app\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/\.\.\/legacy(?:\/|['"])/,
];

async function collectIngestFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectIngestFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  }));

  return files.flat();
}

describe('ingest module boundary', () => {
  test('does not import app/legacy from within app/modules/ingest', async () => {
    const files = await collectIngestFiles(ingestRoot);

    for (const filePath of files) {
      if (allowedLegacyImportFiles.has(filePath)) {
        continue;
      }

      const source = await readFile(filePath, 'utf8');
      const hasForbiddenImport = forbiddenImportPatterns.some(pattern => pattern.test(source));

      expect(hasForbiddenImport, `Forbidden legacy import found in ${relative(process.cwd(), filePath)}`).toBe(false);
    }
  });
});
