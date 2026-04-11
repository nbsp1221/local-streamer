import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const PROJECT_ROOT = resolve(__dirname, '../../..');

const ACTIVE_PLAYBACK_FILES = [
  'app/composition/server/playback.ts',
  'app/routes/player.$id.tsx',
  'app/routes/videos.$videoId.token.ts',
  'app/routes/videos.$videoId.manifest[.]mpd.ts',
  'app/routes/videos.$videoId.video.$filename.ts',
  'app/routes/videos.$videoId.audio.$filename.ts',
  'app/routes/videos.$videoId.clearkey.ts',
] as const;

const PLAYBACK_COMPAT_SEAM_FILES = [
  'app/modules/playback/infrastructure/catalog/playback-video-catalog.adapter.ts',
  'app/modules/playback/infrastructure/token/jsonwebtoken-playback-token.service.ts',
  'app/modules/playback/infrastructure/token/playback-token.service.ts',
  'app/modules/playback/infrastructure/media/playback-manifest.service.ts',
  'app/modules/playback/infrastructure/media/playback-media-segment.service.ts',
  'app/modules/playback/infrastructure/license/playback-clearkey.service.ts',
] as const;

const RETIRED_PLAYBACK_FILES = [
  'app/modules/playback/infrastructure/catalog/legacy-video-catalog.adapter.ts',
  'app/modules/playback/infrastructure/media/legacy-playback-manifest.service.adapter.ts',
  'app/modules/playback/infrastructure/media/legacy-playback-media-segment.service.adapter.ts',
  'app/modules/playback/infrastructure/license/legacy-playback-clearkey.service.adapter.ts',
] as const;

function includesLegacyAppImport(source: string) {
  return source.includes('~/legacy/');
}

async function pathExists(file: string) {
  try {
    await access(resolve(PROJECT_ROOT, file));
    return true;
  }
  catch {
    return false;
  }
}

describe('playback ownership boundary', () => {
  test('active playback composition and routes do not import app/legacy directly', async () => {
    for (const file of ACTIVE_PLAYBACK_FILES) {
      const source = await readFile(resolve(PROJECT_ROOT, file), 'utf8');
      expect(includesLegacyAppImport(source), file).toBe(false);
    }
  });

  test('active playback infrastructure files do not import app/legacy directly', async () => {
    for (const file of PLAYBACK_COMPAT_SEAM_FILES) {
      const source = await readFile(resolve(PROJECT_ROOT, file), 'utf8');
      expect(includesLegacyAppImport(source), file).toBe(false);
    }
  });

  test('active playback infrastructure files do not delegate to retired legacy playback adapters', async () => {
    for (const file of PLAYBACK_COMPAT_SEAM_FILES) {
      const source = await readFile(resolve(PROJECT_ROOT, file), 'utf8');
      expect(source.includes('ConstructorParameters<'), file).toBe(false);
      expect(source.includes('LegacyVideoCatalogAdapter'), file).toBe(false);
      expect(source.includes('LegacyPlaybackManifestServiceAdapter'), file).toBe(false);
      expect(source.includes('LegacyPlaybackMediaSegmentServiceAdapter'), file).toBe(false);
      expect(source.includes('LegacyPlaybackClearKeyServiceAdapter'), file).toBe(false);
    }
  });

  test('retired playback adapter source files no longer exist on disk', async () => {
    for (const file of RETIRED_PLAYBACK_FILES) {
      await expect(pathExists(file), file).resolves.toBe(false);
    }
  });
});
