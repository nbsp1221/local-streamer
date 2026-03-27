import { afterEach, describe, expect, test, vi } from 'vitest';

const createLegacyMutationPortMock = vi.fn();
const createLegacyArtifactRemovalPortMock = vi.fn();

vi.mock('~/composition/server/library-legacy-video-mutation', () => ({
  createLibraryLegacyVideoArtifactRemovalPort: createLegacyArtifactRemovalPortMock,
  createLibraryLegacyVideoMutationPort: createLegacyMutationPortMock,
}));

describe('server library mutation composition root', () => {
  afterEach(() => {
    vi.resetModules();
    createLegacyArtifactRemovalPortMock.mockReset();
    createLegacyMutationPortMock.mockReset();
  });

  test('creates prewired update and delete services from the injected mutation port', async () => {
    const { createServerLibraryServices } = await import('../../../app/composition/server/library');
    const findLibraryVideoById = vi.fn(async videoId => ({
      createdAt: new Date('2026-03-11T00:00:00.000Z'),
      duration: 180,
      id: videoId,
      tags: ['Action'],
      title: 'Fixture Video',
      videoUrl: '/videos/video-1/manifest.mpd',
    }));
    const updateLibraryVideo = vi.fn(async input => ({
      createdAt: new Date('2026-03-11T00:00:00.000Z'),
      description: input.description,
      duration: 180,
      id: input.videoId,
      tags: input.tags,
      title: input.title,
      videoUrl: '/videos/video-1/manifest.mpd',
    }));
    const deleteLibraryVideo = vi.fn(async () => ({
      deleted: true,
      title: 'Fixture Video',
    }));
    const cleanupVideoArtifacts = vi.fn(async () => ({}));

    const services = createServerLibraryServices({
      artifactRemovalPort: {
        cleanupVideoArtifacts,
      },
      mutationPort: {
        deleteLibraryVideo,
        findLibraryVideoById,
        updateLibraryVideo,
      },
      videoSource: {
        listLibraryVideos: vi.fn(async () => []),
      },
    });

    await expect(services.updateLibraryVideo.execute({
      description: ' Updated description ',
      tags: [' Action ', 'Neo'],
      title: ' Updated title ',
      videoId: 'video-1',
    })).resolves.toEqual({
      data: {
        message: 'Video "Updated title" updated successfully',
        video: expect.objectContaining({
          id: 'video-1',
          title: 'Updated title',
        }),
      },
      ok: true,
    });
    await expect(services.deleteLibraryVideo.execute({
      videoId: 'video-1',
    })).resolves.toEqual({
      data: {
        message: 'Video deleted successfully',
        title: 'Fixture Video',
        videoId: 'video-1',
        warning: undefined,
      },
      ok: true,
    });
    expect(createLegacyMutationPortMock).not.toHaveBeenCalled();
    expect(createLegacyArtifactRemovalPortMock).not.toHaveBeenCalled();
  });

  test('returns a cached default composition with update and delete services ready for route usage', async () => {
    createLegacyMutationPortMock.mockReturnValue({
      deleteLibraryVideo: vi.fn(async () => ({
        deleted: true,
        title: 'Fixture Video',
      })),
      findLibraryVideoById: vi.fn(async videoId => ({
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
        duration: 180,
        id: videoId,
        tags: ['Action'],
        title: 'Fixture Video',
        videoUrl: '/videos/video-1/manifest.mpd',
      })),
      updateLibraryVideo: vi.fn(async input => ({
        createdAt: new Date('2026-03-11T00:00:00.000Z'),
        duration: 180,
        id: input.videoId,
        tags: input.tags,
        title: input.title,
        videoUrl: '/videos/video-1/manifest.mpd',
      })),
    });
    createLegacyArtifactRemovalPortMock.mockReturnValue({
      cleanupVideoArtifacts: vi.fn(async () => ({})),
    });
    vi.resetModules();

    const { getServerLibraryServices } = await import('../../../app/composition/server/library');
    const first = getServerLibraryServices();
    const second = getServerLibraryServices();

    expect(first).toBe(second);
    expect(first.updateLibraryVideo).toBeDefined();
    expect(first.deleteLibraryVideo).toBeDefined();
  });
});
