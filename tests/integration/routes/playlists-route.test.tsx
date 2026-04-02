import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
const PROJECT_ROOT = resolve(__dirname, '../../..');

async function importPlaylistsRoute() {
  return import('../../../app/routes/playlists._index');
}

async function importPlaylistDetailRoute() {
  return import('../../../app/routes/playlists.$id');
}

describe('playlist route adapters', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('~/composition/server/auth');
    vi.doUnmock('~/composition/server/playlist');
  });

  test('playlist index loader delegates auth and playlist composition', async () => {
    const requireProtectedPageSessionMock = vi.fn().mockResolvedValue({ id: 'session-1' });
    const resolveServerPlaylistOwnerIdMock = vi.fn().mockResolvedValue('owner-1');
    const fakePlaylistServices = {
      getPlaylistDetails: { execute: vi.fn() },
      findPlaylists: {
        execute: vi.fn().mockResolvedValue({
          data: {
            playlists: [{ id: 'playlist-1', name: 'Vault', videoIds: ['video-1'] }],
            totalCount: 1,
          },
          success: true,
        }),
      },
    };

    vi.doMock('~/composition/server/auth', () => ({
      requireProtectedPageSession: requireProtectedPageSessionMock,
    }));
    vi.doMock('~/composition/server/playlist', () => ({
      getServerPlaylistServices: () => fakePlaylistServices,
      resolveServerPlaylistOwnerId: resolveServerPlaylistOwnerIdMock,
    }));

    const { loader } = await importPlaylistsRoute();

    const result = await loader({
      request: new Request('http://localhost/playlists?q=vault'),
    } as never);

    expect(requireProtectedPageSessionMock).toHaveBeenCalledWith(expect.any(Request));
    expect(resolveServerPlaylistOwnerIdMock).toHaveBeenCalledTimes(1);
    expect(fakePlaylistServices.findPlaylists.execute).toHaveBeenCalledWith(expect.objectContaining({
      filters: expect.objectContaining({ searchQuery: 'vault' }),
      ownerId: 'owner-1',
    }));
    expect(result).toEqual({
      playlists: [{ id: 'playlist-1', name: 'Vault', videoIds: ['video-1'] }],
      searchQuery: 'vault',
      total: 1,
      videoCountMap: { 'playlist-1': 1 },
    });
  });

  test('playlist routes render active page modules instead of legacy page paths', async () => {
    const [playlistsIndexSource, playlistDetailSource] = await Promise.all([
      readFile(resolve(PROJECT_ROOT, 'app/routes/playlists._index.tsx'), 'utf8'),
      readFile(resolve(PROJECT_ROOT, 'app/routes/playlists.$id.tsx'), 'utf8'),
    ]);

    expect(playlistsIndexSource).toContain('~/pages/playlists/ui/PlaylistsPage');
    expect(playlistsIndexSource).not.toContain('~/legacy/pages/playlists/ui/PlaylistsPage');
    expect(playlistDetailSource).toContain('~/pages/playlist-detail/ui/PlaylistDetailPage');
    expect(playlistDetailSource).not.toContain('~/legacy/pages/playlist-detail/ui/PlaylistDetailPage');
  });

  test('playlist detail loader delegates auth and playlist composition', async () => {
    const requireProtectedPageSessionMock = vi.fn().mockResolvedValue({ id: 'session-1' });
    const resolveServerPlaylistOwnerIdMock = vi.fn().mockResolvedValue('owner-1');
    const fakePlaylistServices = {
      findPlaylists: { execute: vi.fn() },
      getPlaylistDetails: {
        execute: vi.fn().mockResolvedValue({
          data: {
            permissions: { canAddVideos: true, canDelete: true, canEdit: true, canShare: true },
            playlist: {
              createdAt: new Date('2026-03-08T00:00:00.000Z'),
              id: 'playlist-1',
              isPublic: false,
              name: 'Vault',
              ownerId: 'owner-1',
              type: 'user_created',
              updatedAt: new Date('2026-03-08T00:00:00.000Z'),
              videoIds: ['video-1'],
              videos: [{ duration: 90, id: 'video-1', position: 1, title: 'playtime' }],
            },
            relatedPlaylists: [],
            stats: null,
            videoPagination: null,
          },
          success: true,
        }),
      },
    };

    vi.doMock('~/composition/server/auth', () => ({
      requireProtectedPageSession: requireProtectedPageSessionMock,
    }));
    vi.doMock('~/composition/server/playlist', () => ({
      getServerPlaylistServices: () => fakePlaylistServices,
      resolveServerPlaylistOwnerId: resolveServerPlaylistOwnerIdMock,
    }));

    const { loader } = await importPlaylistDetailRoute();
    const result = await loader({
      params: { id: 'playlist-1' },
      request: new Request('http://localhost/playlists/playlist-1'),
    } as never);

    expect(requireProtectedPageSessionMock).toHaveBeenCalledWith(expect.any(Request));
    expect(resolveServerPlaylistOwnerIdMock).toHaveBeenCalledTimes(1);
    expect(fakePlaylistServices.getPlaylistDetails.execute).toHaveBeenCalledWith({
      includeRelated: false,
      includeStats: true,
      includeVideos: true,
      ownerId: 'owner-1',
      playlistId: 'playlist-1',
      videoLimit: 50,
      videoOffset: 0,
    });
    expect(result).toEqual(expect.objectContaining({
      permissions: expect.objectContaining({
        canAddVideos: true,
        canDelete: true,
        canEdit: true,
        canShare: true,
      }),
      playlist: expect.objectContaining({
        id: 'playlist-1',
        videos: [
          expect.objectContaining({
            id: 'video-1',
            title: 'playtime',
          }),
        ],
      }),
    }));
  });
});
