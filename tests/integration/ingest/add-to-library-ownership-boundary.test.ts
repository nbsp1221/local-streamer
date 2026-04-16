import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';

const projectRoot = process.cwd();
const explicitFiles = [
  join(projectRoot, 'app/routes/api.add-to-library.ts'),
  join(projectRoot, 'app/modules/ingest/application/use-cases/add-video-to-library.usecase.ts'),
  join(projectRoot, 'app/composition/server/ingest.ts'),
  join(projectRoot, 'app/modules/ingest/infrastructure/storage/ingest-storage-paths.server.ts'),
  join(projectRoot, 'app/modules/ingest/infrastructure/analysis/ffprobe-ingest-video-analysis.adapter.ts'),
  join(projectRoot, 'app/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter.ts'),
  join(projectRoot, 'app/modules/ingest/infrastructure/workspace/filesystem-ingest-prepared-video-workspace.adapter.ts'),
];
const ingestPortRoot = join(projectRoot, 'app/modules/ingest/application/ports');
const ingestProcessingRoot = join(projectRoot, 'app/modules/ingest/infrastructure/processing');
const files = [
  ...explicitFiles,
];
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

async function collectTypescriptFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      return collectTypescriptFiles(fullPath);
    }

    return entry.name.endsWith('.ts') ? [fullPath] : [];
  }));

  return files.flat();
}

describe('add-to-library ownership boundary', () => {
  test('active route and application code do not import app/legacy directly', async () => {
    const filesToScan = [
      ...files,
      ...await collectPortFiles(ingestPortRoot),
      ...await collectTypescriptFiles(ingestProcessingRoot),
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

  test('ingest composition no longer depends on the broad legacy library-intake seam', async () => {
    const filePath = join(projectRoot, 'app/composition/server/ingest.ts');
    const source = await readFile(filePath, 'utf8');

    expect(
      source.includes('./ingest-legacy-library-intake'),
      'ingest.ts should not import the retired broad library-intake seam',
    ).toBe(false);
  });

  test('ingest composition no longer depends on the legacy prepared-workspace seam', async () => {
    const filePath = join(projectRoot, 'app/composition/server/ingest.ts');
    const source = await readFile(filePath, 'utf8');

    expect(
      source.includes('./ingest-legacy-prepared-video-workspace'),
      'ingest.ts should not import the retired prepared-workspace seam',
    ).toBe(false);
  });

  test('ingest composition no longer depends on the legacy video-processing seam', async () => {
    const filePath = join(projectRoot, 'app/composition/server/ingest.ts');
    const source = await readFile(filePath, 'utf8');

    expect(
      source.includes('./ingest-legacy-video-processing'),
      'ingest.ts should not import the retired video-processing seam',
    ).toBe(false);
  });

  test('ingest composition no longer depends on the broad legacy video-processing seam', async () => {
    const filePath = join(projectRoot, 'app/composition/server/ingest.ts');
    const source = await readFile(filePath, 'utf8');

    expect(
      source.includes('./ingest-legacy-video-processing'),
      'ingest.ts should not import the retired broad video-processing seam',
    ).toBe(false);
  });

  test('add-to-library use case no longer depends on the broad ingest library-intake port', async () => {
    const filePath = join(projectRoot, 'app/modules/ingest/application/use-cases/add-video-to-library.usecase.ts');
    const source = await readFile(filePath, 'utf8');

    expect(
      source.includes('IngestLibraryIntakePort'),
      'add-video-to-library.usecase.ts should depend on narrower ingest ports',
    ).toBe(false);
  });
});
