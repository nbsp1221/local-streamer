import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const projectRoot = process.cwd();
const activeAddVideosRoots = [
  join(projectRoot, 'app/routes/add-videos.tsx'),
  join(projectRoot, 'app/pages/add-videos'),
  join(projectRoot, 'app/widgets/add-videos'),
  join(projectRoot, 'app/widgets/add-videos-shell'),
  join(projectRoot, 'app/features/add-videos-encoding'),
  join(projectRoot, 'app/entities/pending-video/model/pending-upload-video.ts'),
];
const forbiddenImportPatterns = [
  /(?:from|import\s*\(|require\s*\()\s*['"]~\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]app\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/\.\.\/legacy(?:\/|['"])/,
];

async function collectFiles(path: string): Promise<string[]> {
  const exists = await stat(path).then(() => true).catch(() => false);

  if (!exists) {
    return [];
  }

  if (path.endsWith('.ts') || path.endsWith('.tsx')) {
    return [path];
  }

  const entries = await readdir(path, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(path, entry.name);

    if (entry.isDirectory()) {
      return collectFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  }));

  return files.flat();
}

describe('add-videos UI ownership boundary', () => {
  test('active add-videos route path does not import app/legacy', async () => {
    const files = (await Promise.all(activeAddVideosRoots.map(collectFiles))).flat();

    for (const filePath of files) {
      const source = await readFile(filePath, 'utf8');
      const hasForbiddenImport = forbiddenImportPatterns.some(pattern => pattern.test(source));

      expect(
        hasForbiddenImport,
        `Forbidden legacy import found in ${relative(projectRoot, filePath)}`,
      ).toBe(false);
    }
  });
});
