import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const projectRoot = process.cwd();
const explicitFiles = [
  join(projectRoot, 'app/routes/api.scan-incoming.ts'),
  join(projectRoot, 'app/modules/ingest/application/use-cases/scan-incoming-videos.usecase.ts'),
];
const ingestPortRoot = join(projectRoot, 'app/modules/ingest/application/ports');
const forbiddenImportPatterns = [
  /(?:from|import\s*\(|require\s*\()\s*['"]~\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]app\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/legacy(?:\/|['"])/,
  /(?:from|import\s*\(|require\s*\()\s*['"]\.\.\/\.\.\/\.\.\/legacy(?:\/|['"])/,
];

async function collectPortFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectPortFiles(fullPath);
    }

    return entry.name.endsWith('.ts') ? [fullPath] : [];
  }));

  return files.flat();
}

describe('scan-incoming ownership boundary', () => {
  test('active route and application code do not import app/legacy directly', async () => {
    const filesToScan = [
      ...explicitFiles,
      ...await collectPortFiles(ingestPortRoot),
    ];

    for (const filePath of filesToScan) {
      const source = await readFile(filePath, 'utf8');
      const hasForbiddenImport = forbiddenImportPatterns.some(pattern => pattern.test(source));

      expect(
        hasForbiddenImport,
        `Forbidden legacy import found in ${relative(projectRoot, filePath)}`,
      ).toBe(false);
    }
  });

  test('ingest composition no longer depends on the retired broad legacy incoming-video source seam', async () => {
    const filePath = join(projectRoot, 'app/composition/server/ingest.ts');
    const source = await readFile(filePath, 'utf8');

    expect(
      source.includes('./ingest-legacy-incoming-video-source'),
      'ingest.ts should not import the retired broad incoming-video seam',
    ).toBe(false);
  });

  test('scan-incoming use case no longer depends on the broad ingest incoming-video source port', async () => {
    const filePath = join(projectRoot, 'app/modules/ingest/application/use-cases/scan-incoming-videos.usecase.ts');
    const source = await readFile(filePath, 'utf8');

    expect(
      source.includes('IngestIncomingVideoSourcePort'),
      'scan-incoming-videos.usecase.ts should depend on narrower ingest scan ports',
    ).toBe(false);
  });
});
