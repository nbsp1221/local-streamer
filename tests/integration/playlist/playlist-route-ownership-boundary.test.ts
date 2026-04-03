import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const PROJECT_ROOT = resolve(__dirname, '../../..');

const ACTIVE_PLAYLIST_ROUTE_FILES = [
  'app/routes/api.playlists.ts',
  'app/routes/api.playlists.$id.ts',
  'app/routes/api.playlists.$id.items.ts',
  'app/routes/api.playlists.$id.items.$videoId.ts',
] as const;

const ACTIVE_PLAYLIST_PAGE_ROUTE_FILES = [
  'app/routes/playlists._index.tsx',
  'app/routes/playlists.$id.tsx',
] as const;

const ACTIVE_PLAYLIST_INFRASTRUCTURE_FILES = [
  'app/modules/playlist/infrastructure/json/json-playlist.repository.ts',
  'app/modules/playlist/infrastructure/json/json-write-queue.ts',
  'app/modules/playlist/infrastructure/json/playlist-storage-paths.server.ts',
  'app/modules/playlist/infrastructure/video/sqlite-playlist-video-catalog.adapter.ts',
] as const;

function includesLegacyImport(source: string) {
  return source.includes('~/legacy/');
}

describe('playlist route ownership boundary', () => {
  test('active playlist API routes do not import app/legacy directly', async () => {
    for (const file of ACTIVE_PLAYLIST_ROUTE_FILES) {
      const source = await readFile(resolve(PROJECT_ROOT, file), 'utf8');
      expect(includesLegacyImport(source), file).toBe(false);
      expect(source.includes('resolveLegacyCompatibilityUser'), file).toBe(false);
    }
  });

  test('active playlist page routes do not import legacy playlist pages or domain types', async () => {
    for (const file of ACTIVE_PLAYLIST_PAGE_ROUTE_FILES) {
      const source = await readFile(resolve(PROJECT_ROOT, file), 'utf8');
      expect(includesLegacyImport(source), file).toBe(false);
      expect(source.includes('resolveLegacyCompatibilityUser'), file).toBe(false);
    }
  });

  test('active playlist infrastructure does not import server composition directly', async () => {
    for (const file of ACTIVE_PLAYLIST_INFRASTRUCTURE_FILES) {
      const source = await readFile(resolve(PROJECT_ROOT, file), 'utf8');
      expect(source.includes('~/composition/server/'), file).toBe(false);
    }
  });
});
