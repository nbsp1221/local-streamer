import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const PROJECT_ROOT = resolve(__dirname, '../../..');

const PAGE_ROUTE_FILES = [
  'app/routes/playlists._index.tsx',
  'app/routes/playlists.$id.tsx',
] as const;

describe('playlist page loader composition', () => {
  test('playlist page loaders do not self-fetch internal playlist APIs over HTTP', async () => {
    for (const file of PAGE_ROUTE_FILES) {
      const source = await readFile(resolve(PROJECT_ROOT, file), 'utf8');

      expect(source.includes(`'/api/playlists`)).toBe(false);
      expect(source.includes('"/api/playlists')).toBe(false);
      expect(source.includes('fetch(apiUrl')).toBe(false);
    }
  });
});
