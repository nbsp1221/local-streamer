import { describe, expect, test } from 'vitest';

describe('ResolvePlayerVideoUseCase', () => {
  test('returns the current video plus related videos from the catalog port', async () => {
    const { ResolvePlayerVideoUseCase } = await import('./resolve-player-video.usecase');
    const useCase = new ResolvePlayerVideoUseCase({
      videoCatalog: {
        getPlayerVideo: async (videoId: string) => (videoId === 'video-1'
          ? {
              relatedVideos: [
                {
                  createdAt: new Date('2026-03-01T00:00:00.000Z'),
                  duration: 45,
                  id: 'video-2',
                  tags: ['drama'],
                  title: 'Related video',
                  videoUrl: '/videos/video-2/master.mpd',
                },
              ],
              video: {
                createdAt: new Date('2026-03-02T00:00:00.000Z'),
                duration: 120,
                id: 'video-1',
                tags: ['drama'],
                title: 'Current video',
                videoUrl: '/videos/video-1/master.mpd',
              },
            }
          : null),
      },
    });

    const result = await useCase.execute({
      videoId: 'video-1',
    });

    expect(result).toEqual({
      ok: true,
      relatedVideos: [
        {
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          duration: 45,
          id: 'video-2',
          tags: ['drama'],
          title: 'Related video',
          videoUrl: '/videos/video-2/master.mpd',
        },
      ],
      video: {
        createdAt: new Date('2026-03-02T00:00:00.000Z'),
        duration: 120,
        id: 'video-1',
        tags: ['drama'],
        title: 'Current video',
        videoUrl: '/videos/video-1/master.mpd',
      },
    });
  });

  test('returns an explicit not-found result when the catalog cannot resolve the video', async () => {
    const { ResolvePlayerVideoUseCase } = await import('./resolve-player-video.usecase');
    const useCase = new ResolvePlayerVideoUseCase({
      videoCatalog: {
        getPlayerVideo: async () => null,
      },
    });

    const result = await useCase.execute({
      videoId: 'missing-video',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'VIDEO_NOT_FOUND',
    });
  });
});
