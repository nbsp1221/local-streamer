import { describe, expect, test } from 'vitest';

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

  test('returns null when the legacy repository cannot resolve the requested video', async () => {
    const { PlaybackVideoCatalogAdapter } = await import('./playback-video-catalog.adapter');
    const adapter = new PlaybackVideoCatalogAdapter({
      repository: {
        findAll: async () => [],
      },
    });

    await expect(adapter.getPlayerVideo('missing-video')).resolves.toBeNull();
  });
});
