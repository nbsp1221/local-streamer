import { beforeEach, describe, expect, test, vi } from 'vitest';

describe('sqlite canonical video metadata adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('adapts the sqlite metadata repository to both library reads and ingest metadata writes', async () => {
    const findAll = vi.fn(async () => [
      {
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        description: 'Fixture description',
        duration: 95,
        id: 'video-1',
        tags: ['Action', 'Drama'],
        thumbnailUrl: '/api/thumbnail/video-1',
        title: 'Fixture Video',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    ]);
    const create = vi.fn(async () => ({
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      description: 'A test video',
      duration: 120,
      id: 'video-123',
      tags: ['fixture', 'test'],
      thumbnailUrl: '/api/thumbnail/video-123',
      title: 'Fixture Video',
      videoUrl: '/videos/video-123/manifest.mpd',
    }));

    const { SqliteCanonicalVideoMetadataAdapter } = await import('../../../app/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter');
    const adapter = new SqliteCanonicalVideoMetadataAdapter({
      repository: {
        create,
        findAll,
      },
    });

    await expect(adapter.listLibraryVideos()).resolves.toEqual([
      expect.objectContaining({
        id: 'video-1',
        title: 'Fixture Video',
      }),
    ]);
    await expect(adapter.writeVideoRecord({
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
