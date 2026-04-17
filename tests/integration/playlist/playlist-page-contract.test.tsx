import { afterEach, describe, expect, test, vi } from 'vitest';
import { createPlaylistRuntimeTestWorkspace } from '../../support/create-playlist-runtime-test-workspace';

async function importPlaylistsPageRoute() {
  return import('../../../app/routes/playlists._index');
}

async function importPlaylistDetailPageRoute() {
  return import('../../../app/routes/playlists.$id');
}

async function importPlaylistDetailApiRoute() {
  return import('../../../app/routes/api.playlists.$id');
}

describe.sequential('playlist page contract', () => {
  afterEach(() => {
    vi.doUnmock('~/composition/server/auth');
    vi.doUnmock('~/composition/server/playlist');
    vi.resetModules();
  });

  test('playlists page loader returns the current shaped payload', async () => {
    const workspace = await createPlaylistRuntimeTestWorkspace({
      playlists: [
        {
          createdAt: '2025-10-05T17:17:46.248Z',
          description: 'Owned by the seeded owner',
          id: 'playlist-1',
          isPublic: false,
          name: 'Owned Playlist',
          ownerId: 'seeded-owner-1',
          type: 'user_created',
          updatedAt: '2025-10-05T17:17:46.248Z',
          videoIds: ['video-1', 'video-2'],
        },
      ],
    });

    try {
      const cookie = await workspace.login();
      const { loader } = await importPlaylistsPageRoute();
      const payload = await loader({
        request: new Request('http://localhost/playlists', {
          headers: {
            cookie,
          },
        }),
      } as never);

      expect(payload).toEqual({
        playlists: [
          expect.objectContaining({
            id: 'playlist-1',
            name: 'Owned Playlist',
            videoIds: ['video-1', 'video-2'],
          }),
        ],
        searchQuery: '',
        total: 1,
        videoCountMap: {
          'playlist-1': 2,
        },
      });
    }
    finally {
      await workspace.cleanup();
    }
  });

  test('playlist detail loader returns playlist, stats, related playlists, pagination, and permissions', async () => {
    const workspace = await createPlaylistRuntimeTestWorkspace({
      playlists: [
        {
          createdAt: '2025-10-05T17:17:46.248Z',
          description: 'Owned by the seeded owner',
          id: 'playlist-1',
          isPublic: false,
          metadata: {
            genre: ['Action'],
          },
          name: 'Owned Playlist',
          ownerId: 'seeded-owner-1',
          type: 'user_created',
          updatedAt: '2025-10-05T17:17:46.248Z',
          videoIds: ['68e5f819-15e8-41ef-90ee-8a96769311b7'],
        },
      ],
    });

    try {
      const cookie = await workspace.login();
      const { loader } = await importPlaylistDetailPageRoute();
      const payload = await loader({
        params: { id: 'playlist-1' },
        request: new Request('http://localhost/playlists/playlist-1', {
          headers: {
            cookie,
          },
        }),
      } as never);

      expect(payload).toEqual({
        permissions: expect.objectContaining({
          canAddVideos: true,
          canDelete: true,
          canEdit: true,
          canShare: true,
        }),
        playlist: expect.objectContaining({
          id: 'playlist-1',
          name: 'Owned Playlist',
        }),
        relatedPlaylists: [],
        stats: expect.objectContaining({
          id: 'playlist-1',
          totalVideos: 1,
        }),
        videoPagination: expect.objectContaining({
          hasMore: false,
          limit: 50,
          offset: 0,
          total: 1,
        }),
      });
    }
    finally {
      await workspace.cleanup();
    }
  });

  test('playlist detail loader preserves 404 failures', async () => {
    const workspace = await createPlaylistRuntimeTestWorkspace();

    try {
      const cookie = await workspace.login();
      const { loader } = await importPlaylistDetailPageRoute();

      try {
        await loader({
          params: { id: 'missing-playlist' },
          request: new Request('http://localhost/playlists/missing-playlist', {
            headers: {
              cookie,
            },
          }),
        } as never);
        throw new Error('Expected loader to throw');
      }
      catch (error) {
        expect(error).toBeInstanceOf(Response);
        expect((error as Response).status).toBe(404);
      }
    }
    finally {
      await workspace.cleanup();
    }
  });

  test('playlist detail API does not expose private related playlists from the same series', async () => {
    const workspace = await createPlaylistRuntimeTestWorkspace({
      playlists: [
        {
          createdAt: '2025-10-05T17:17:46.248Z',
          description: 'Public season visible to any signed-in user',
          id: 'season-public',
          isPublic: true,
          metadata: {
            parentPlaylistId: 'series-private',
            seasonNumber: 1,
            seriesName: 'Vault Saga',
          },
          name: 'Vault Saga Season 1',
          ownerId: 'other-user',
          type: 'season',
          updatedAt: '2025-10-05T17:17:46.248Z',
          videoIds: ['playlist-video-2'],
        },
        {
          createdAt: '2025-10-05T17:17:46.248Z',
          description: 'Private parent series',
          id: 'series-private',
          isPublic: false,
          metadata: {
            seriesName: 'Vault Saga',
          },
          name: 'Vault Saga',
          ownerId: 'other-user',
          type: 'series',
          updatedAt: '2025-10-05T17:17:46.248Z',
          videoIds: [],
        },
        {
          createdAt: '2025-10-05T17:17:46.248Z',
          description: 'Private sibling season',
          id: 'season-private',
          isPublic: false,
          metadata: {
            parentPlaylistId: 'series-private',
            seasonNumber: 2,
            seriesName: 'Vault Saga',
          },
          name: 'Vault Saga Season 2',
          ownerId: 'other-user',
          type: 'season',
          updatedAt: '2025-10-05T17:17:46.248Z',
          videoIds: ['playlist-video-1'],
        },
      ],
    });

    try {
      const cookie = await workspace.login();
      const { loader } = await importPlaylistDetailApiRoute();
      const response = await loader({
        params: { id: 'season-public' },
        request: new Request('http://localhost/api/playlists/season-public?includeRelated=true', {
          headers: {
            cookie,
          },
        }),
      } as never);

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(expect.objectContaining({
        relatedPlaylists: [],
      }));
    }
    finally {
      await workspace.cleanup();
    }
  });
});
