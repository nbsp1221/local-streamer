import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

const ORIGINAL_STORAGE_DIR = process.env.STORAGE_DIR;
const ORIGINAL_VIDEO_METADATA_SQLITE_PATH = process.env.VIDEO_METADATA_SQLITE_PATH;

afterEach(() => {
  vi.resetModules();

  if (ORIGINAL_STORAGE_DIR === undefined) {
    delete process.env.STORAGE_DIR;
  }
  else {
    process.env.STORAGE_DIR = ORIGINAL_STORAGE_DIR;
  }

  if (ORIGINAL_VIDEO_METADATA_SQLITE_PATH === undefined) {
    delete process.env.VIDEO_METADATA_SQLITE_PATH;
  }
  else {
    process.env.VIDEO_METADATA_SQLITE_PATH = ORIGINAL_VIDEO_METADATA_SQLITE_PATH;
  }
});

describe('PlaybackVideoCatalogAdapter', () => {
  test('returns the current video and related videos without exposing repository details upward', async () => {
    const { PlaybackVideoCatalogAdapter } = await import('./playback-video-catalog.adapter');
    const adapter = new PlaybackVideoCatalogAdapter({
      repository: {
        findAll: async () => [
          {
            createdAt: new Date('2026-03-02T00:00:00.000Z'),
            duration: 120,
            id: 'video-1',
            tags: ['Drama', 'Vault'],
            title: 'Current video',
            videoUrl: '/videos/video-1/manifest.mpd',
          },
          {
            createdAt: new Date('2026-03-01T00:00:00.000Z'),
            duration: 40,
            id: 'video-2',
            tags: ['drama'],
            title: 'Related video',
            videoUrl: '/videos/video-2/manifest.mpd',
          },
          {
            createdAt: new Date('2026-02-28T00:00:00.000Z'),
            duration: 60,
            id: 'video-3',
            tags: ['other'],
            title: 'Unrelated video',
            videoUrl: '/videos/video-3/manifest.mpd',
          },
        ],
      },
    });

    const result = await adapter.getPlayerVideo('video-1');

    expect(result).toEqual({
      relatedVideos: [
        {
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          duration: 40,
          id: 'video-2',
          tags: ['drama'],
          title: 'Related video',
          videoUrl: '/videos/video-2/manifest.mpd',
        },
      ],
      video: {
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
        duration: 120,
        id: 'video-1',
        tags: ['Drama', 'Vault'],
        title: 'Current video',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    });
  });

  test('returns null when the playback repository cannot resolve the requested video', async () => {
    const { PlaybackVideoCatalogAdapter } = await import('./playback-video-catalog.adapter');
    const adapter = new PlaybackVideoCatalogAdapter({
      repository: {
        findAll: async () => [],
      },
    });

    await expect(adapter.getPlayerVideo('missing-video')).resolves.toBeNull();
  });

  test('bootstraps SQLite metadata from videos.json when the active metadata store is still empty', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'playback-catalog-'));
    const storageDir = path.join(rootDir, 'storage');
    const dataDir = path.join(storageDir, 'data');
    const sqlitePath = path.join(dataDir, 'video-metadata.sqlite');
    process.env.STORAGE_DIR = storageDir;
    process.env.VIDEO_METADATA_SQLITE_PATH = sqlitePath;
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, 'videos.json'), JSON.stringify([
      {
        createdAt: '2026-03-02T00:00:00.000Z',
        description: 'Bootstrap source',
        duration: 120,
        id: 'video-1',
        tags: ['Drama', 'Vault'],
        thumbnailUrl: '/api/thumbnail/video-1',
        title: 'Current video',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    ], null, 2));

    try {
      const { PlaybackVideoCatalogAdapter } = await import('./playback-video-catalog.adapter');
      const adapter = new PlaybackVideoCatalogAdapter();

      await expect(adapter.getPlayerVideo('video-1')).resolves.toEqual({
        relatedVideos: [],
        video: expect.objectContaining({
          id: 'video-1',
          title: 'Current video',
        }),
      });
      await expect(readFile(sqlitePath)).resolves.toBeDefined();
    }
    finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('preserves legacy addedAt timestamps when bootstrapping videos.json into SQLite', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'playback-catalog-'));
    const storageDir = path.join(rootDir, 'storage');
    const dataDir = path.join(storageDir, 'data');
    const sqlitePath = path.join(dataDir, 'video-metadata.sqlite');
    process.env.STORAGE_DIR = storageDir;
    process.env.VIDEO_METADATA_SQLITE_PATH = sqlitePath;
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, 'videos.json'), JSON.stringify([
      {
        addedAt: '2025-01-02T03:04:05.000Z',
        duration: 120,
        id: 'video-1',
        tags: ['Drama'],
        title: 'Legacy timestamp video',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    ], null, 2));

    try {
      const { PlaybackVideoCatalogAdapter } = await import('./playback-video-catalog.adapter');
      const adapter = new PlaybackVideoCatalogAdapter();

      await expect(adapter.getPlayerVideo('video-1')).resolves.toEqual({
        relatedVideos: [],
        video: expect.objectContaining({
          createdAt: new Date('2025-01-02T03:04:05.000Z'),
          id: 'video-1',
          title: 'Legacy timestamp video',
        }),
      });
    }
    finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });

  test('falls back to addedAt when createdAt is an empty legacy string', async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), 'playback-catalog-'));
    const storageDir = path.join(rootDir, 'storage');
    const dataDir = path.join(storageDir, 'data');
    const sqlitePath = path.join(dataDir, 'video-metadata.sqlite');
    process.env.STORAGE_DIR = storageDir;
    process.env.VIDEO_METADATA_SQLITE_PATH = sqlitePath;
    await mkdir(dataDir, { recursive: true });
    await writeFile(path.join(dataDir, 'videos.json'), JSON.stringify([
      {
        addedAt: '2025-01-02T03:04:05.000Z',
        createdAt: '',
        duration: 120,
        id: 'video-1',
        tags: ['Drama'],
        title: 'Mixed legacy timestamp video',
        videoUrl: '/videos/video-1/manifest.mpd',
      },
    ], null, 2));

    try {
      const { PlaybackVideoCatalogAdapter } = await import('./playback-video-catalog.adapter');
      const adapter = new PlaybackVideoCatalogAdapter();

      await expect(adapter.getPlayerVideo('video-1')).resolves.toEqual({
        relatedVideos: [],
        video: expect.objectContaining({
          createdAt: new Date('2025-01-02T03:04:05.000Z'),
          id: 'video-1',
          title: 'Mixed legacy timestamp video',
        }),
      });
    }
    finally {
      await rm(rootDir, { force: true, recursive: true });
    }
  });
});
