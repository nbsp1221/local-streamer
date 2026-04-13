import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('sqlite library video mutation adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('reads and updates library videos through the sqlite metadata repository', async () => {
    const findById = vi.fn(async (videoId: string) => ({
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      description: 'Fixture description',
      duration: 95,
      id: videoId,
      tags: ['Action', 'Drama'],
      thumbnailUrl: '/uploads/thumbnails/video-1.jpg',
      title: 'Fixture Video',
      videoUrl: '/videos/video-1/manifest.mpd',
    }));
    const update = vi.fn(async (videoId: string, input: Record<string, unknown>) => ({
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      description: input.description as string,
      duration: 95,
      id: videoId,
      tags: input.tags as string[],
      thumbnailUrl: '/uploads/thumbnails/video-1.jpg',
      title: input.title as string,
      videoUrl: '/videos/video-1/manifest.mpd',
    }));

    const { SqliteLibraryVideoMutationAdapter } = await import('../../../app/modules/library/infrastructure/sqlite/sqlite-library-video-mutation.adapter');
    const adapter = new SqliteLibraryVideoMutationAdapter({
      repository: {
        delete: vi.fn(),
        findById,
        update,
      },
    });

    await expect(adapter.findLibraryVideoById('video-1')).resolves.toEqual(expect.objectContaining({
      id: 'video-1',
      title: 'Fixture Video',
    }));
    await expect(adapter.updateLibraryVideo({
      description: 'Updated description',
      tags: ['Neo'],
      title: 'Updated title',
      videoId: 'video-1',
    })).resolves.toEqual(expect.objectContaining({
      description: 'Updated description',
      id: 'video-1',
      tags: ['Neo'],
      title: 'Updated title',
    }));

    expect(findById).toHaveBeenCalledWith('video-1');
    expect(update).toHaveBeenCalledWith('video-1', {
      description: 'Updated description',
      tags: ['Neo'],
      title: 'Updated title',
    });
  });

  test('preserves the delete result contract expected by the library use case', async () => {
    const findById = vi
      .fn()
      .mockResolvedValueOnce({
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        duration: 95,
        id: 'video-1',
        tags: ['Action'],
        title: 'Fixture Video',
        videoUrl: '/videos/video-1/manifest.mpd',
      })
      .mockResolvedValueOnce(null);
    const remove = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const { SqliteLibraryVideoMutationAdapter } = await import('../../../app/modules/library/infrastructure/sqlite/sqlite-library-video-mutation.adapter');
    const adapter = new SqliteLibraryVideoMutationAdapter({
      repository: {
        delete: remove,
        findById,
        update: vi.fn(),
      },
    });

    await expect(adapter.deleteLibraryVideo({ videoId: 'video-1' })).resolves.toEqual({
      deleted: true,
      title: 'Fixture Video',
    });
    await expect(adapter.deleteLibraryVideo({ videoId: 'missing-video' })).resolves.toEqual({
      deleted: false,
    });

    expect(remove).toHaveBeenNthCalledWith(1, 'video-1');
    expect(remove).not.toHaveBeenNthCalledWith(2, 'missing-video');
  });

  test('bootstraps sqlite metadata before mutation operations when bootstrap is incomplete', async () => {
    const bootstrapFromVideos = vi.fn(async () => undefined);
    const isBootstrapComplete = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const findById = vi.fn(async (videoId: string) => ({
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      duration: 95,
      id: videoId,
      tags: ['Action'],
      title: 'Bootstrap Fixture',
      videoUrl: '/videos/video-1/manifest.mpd',
    }));
    const update = vi.fn(async (videoId: string) => ({
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      duration: 95,
      id: videoId,
      tags: ['Neo'],
      title: 'Updated Fixture',
      videoUrl: '/videos/video-1/manifest.mpd',
    }));
    const remove = vi.fn(async () => true);
    const readBootstrapVideos = vi.fn(async () => [
      {
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        duration: 95,
        id: 'video-1',
        tags: ['Action'],
        title: 'Bootstrap Fixture',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    ]);

    const { SqliteLibraryVideoMutationAdapter } = await import('../../../app/modules/library/infrastructure/sqlite/sqlite-library-video-mutation.adapter');
    const adapter = new SqliteLibraryVideoMutationAdapter({
      readBootstrapVideos,
      repository: {
        bootstrapFromVideos,
        delete: remove,
        findById,
        isBootstrapComplete,
        update,
      },
    });

    await adapter.findLibraryVideoById('video-1');
    await adapter.updateLibraryVideo({
      description: 'Updated description',
      tags: ['Neo'],
      title: 'Updated title',
      videoId: 'video-1',
    });
    await adapter.deleteLibraryVideo({ videoId: 'video-1' });

    expect(isBootstrapComplete).toHaveBeenCalledTimes(3);
    expect(readBootstrapVideos).toHaveBeenCalledOnce();
    expect(bootstrapFromVideos).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'video-1',
      }),
    ]);
    expect(findById).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });
});
