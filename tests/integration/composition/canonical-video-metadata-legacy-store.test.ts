import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('canonical video metadata legacy store', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('adapts the legacy video repository to both library reads and ingest metadata writes', async () => {
    const findAll = vi.fn(async () => [
      {
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        description: 'Fixture description',
        duration: 95,
        id: 'video-1',
        tags: ['Action', 'Drama'],
        thumbnailUrl: '/uploads/thumbnails/video-1.jpg',
        title: 'Fixture Video',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    ]);
    const create = vi.fn(async () => undefined);

    const { createCanonicalVideoMetadataLegacyStore } = await import('../../../app/composition/server/canonical-video-metadata-legacy-store');
    const store = createCanonicalVideoMetadataLegacyStore({
      videoRepository: {
        create,
        findAll,
      } as never,
    });

    await expect(store.listLibraryVideos()).resolves.toEqual([
      expect.objectContaining({
        id: 'video-1',
        title: 'Fixture Video',
      }),
    ]);
    await expect(store.writeVideoRecord({
      description: 'A test video',
      duration: 120,
      id: 'video-123',
      tags: ['fixture', 'test'],
      thumbnailUrl: '/api/thumbnail/video-123',
      title: 'Fixture Video',
      videoUrl: '/videos/video-123/manifest.mpd',
    })).resolves.toBeUndefined();

    expect(findAll).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith({
      description: 'A test video',
      duration: 120,
      id: 'video-123',
      tags: ['fixture', 'test'],
      thumbnailUrl: '/api/thumbnail/video-123',
      title: 'Fixture Video',
      videoUrl: '/videos/video-123/manifest.mpd',
    });
  });
});
