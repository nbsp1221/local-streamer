import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const PROJECT_ROOT = resolve(__dirname, '../../..');

const ACTIVE_PLAYLIST_UI_FILES = [
  'app/pages/playlists/ui/PlaylistsPage.tsx',
  'app/pages/playlist-detail/ui/PlaylistDetailPage.tsx',
  'app/widgets/playlists-view/ui/PlaylistsView.tsx',
  'app/widgets/playlists-view/ui/PlaylistGrid.tsx',
  'app/widgets/playlist-detail-view/ui/PlaylistDetailView.tsx',
  'app/widgets/playlist-detail-view/ui/PlaylistDetailLayout.tsx',
  'app/widgets/playlist-detail-view/ui/PlaylistInfoPanel.tsx',
  'app/widgets/playlist-detail-view/ui/PlaylistVideoList.tsx',
  'app/features/playlist-create/ui/CreatePlaylistDialog.tsx',
  'app/features/playlist-create/ui/CreatePlaylistForm.tsx',
  'app/features/playlist-create/model/useCreatePlaylist.ts',
  'app/entities/playlist/ui/PlaylistCard.tsx',
  'app/shared/ui/route-error-view.tsx',
] as const;

describe('playlist ui ownership boundary', () => {
  test('active playlist ui files do not import app/legacy directly', async () => {
    for (const file of ACTIVE_PLAYLIST_UI_FILES) {
      const source = await readFile(resolve(PROJECT_ROOT, file), 'utf8');
      expect(source.includes('~/legacy/'), file).toBe(false);
    }
  });
});
