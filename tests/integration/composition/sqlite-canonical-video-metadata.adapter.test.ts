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
        thumbnailUrl: '/uploads/thumbnails/video-1.jpg',
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

  test('bootstraps sqlite metadata from videos.json-compatible input before reads and writes when bootstrap is incomplete', async () => {
    const bootstrapFromVideos = vi.fn(async () => undefined);
    const isBootstrapComplete = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const findAll = vi.fn(async () => []);
    const create = vi.fn(async () => ({
      createdAt: new Date('2026-03-10T00:00:00.000Z'),
      duration: 120,
      id: 'video-123',
      tags: [],
      thumbnailUrl: '/api/thumbnail/video-123',
      title: 'Fixture Video',
      videoUrl: '/videos/video-123/manifest.mpd',
    }));
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

    const { SqliteCanonicalVideoMetadataAdapter } = await import('../../../app/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter');
    const adapter = new SqliteCanonicalVideoMetadataAdapter({
      readBootstrapVideos,
      repository: {
        bootstrapFromVideos,
        create,
        findAll,
        isBootstrapComplete,
      },
    });

    await adapter.listLibraryVideos();
    await adapter.writeVideoRecord({
      duration: 120,
      id: 'video-123',
      tags: [],
      thumbnailUrl: '/api/thumbnail/video-123',
      title: 'Fixture Video',
      videoUrl: '/videos/video-123/manifest.mpd',
    });

    expect(isBootstrapComplete).toHaveBeenCalledTimes(2);
    expect(readBootstrapVideos).toHaveBeenCalledOnce();
    expect(bootstrapFromVideos).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'video-1',
        title: 'Bootstrap Fixture',
      }),
    ]);
    expect(findAll).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledOnce();
  });

  test('shares one bootstrap gate across adapter instances targeting the same bootstrap key', async () => {
    let releaseBootstrap!: () => void;
    const bootstrapBlocked = new Promise<void>((resolve) => {
      releaseBootstrap = resolve;
    });

    const repositoryA = {
      bootstrapFromVideos: vi.fn(async () => {
        await bootstrapBlocked;
      }),
      create: vi.fn(async () => ({
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        duration: 120,
        id: 'video-123',
        tags: [],
        thumbnailUrl: '/api/thumbnail/video-123',
        title: 'Fixture Video',
        videoUrl: '/videos/video-123/manifest.mpd',
      })),
      findAll: vi.fn(async () => []),
      isBootstrapComplete: vi.fn(async () => false),
    };
    const repositoryB = {
      bootstrapFromVideos: vi.fn(async () => {
        throw new Error('second bootstrap should not run');
      }),
      create: vi.fn(async () => ({
        createdAt: new Date('2026-03-10T00:00:00.000Z'),
        duration: 120,
        id: 'video-123',
        tags: [],
        thumbnailUrl: '/api/thumbnail/video-123',
        title: 'Fixture Video',
        videoUrl: '/videos/video-123/manifest.mpd',
      })),
      findAll: vi.fn(async () => []),
      isBootstrapComplete: vi.fn(async () => false),
    };
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

    const { SqliteCanonicalVideoMetadataAdapter } = await import('../../../app/modules/library/infrastructure/sqlite/sqlite-canonical-video-metadata.adapter');
    const adapterA = new SqliteCanonicalVideoMetadataAdapter({
      bootstrapKey: 'shared-bootstrap-key',
      readBootstrapVideos,
      repository: repositoryA,
    });
    const adapterB = new SqliteCanonicalVideoMetadataAdapter({
      bootstrapKey: 'shared-bootstrap-key',
      readBootstrapVideos,
      repository: repositoryB,
    });

    const pendingRead = adapterA.listLibraryVideos();
    const pendingWrite = adapterB.writeVideoRecord({
      duration: 120,
      id: 'video-123',
      tags: [],
      thumbnailUrl: '/api/thumbnail/video-123',
      title: 'Fixture Video',
      videoUrl: '/videos/video-123/manifest.mpd',
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    releaseBootstrap();

    await expect(Promise.all([pendingRead, pendingWrite])).resolves.toEqual([
      [],
      undefined,
    ]);
    expect(readBootstrapVideos).toHaveBeenCalledOnce();
    expect(repositoryA.bootstrapFromVideos).toHaveBeenCalledOnce();
    expect(repositoryB.bootstrapFromVideos).not.toHaveBeenCalled();
    expect(repositoryA.findAll).toHaveBeenCalledOnce();
    expect(repositoryB.create).toHaveBeenCalledOnce();
  });
});
