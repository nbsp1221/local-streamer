import { describe, expect, test, vi } from 'vitest';
import { UpdateLibraryVideoUseCase } from './update-library-video.usecase';

describe('UpdateLibraryVideoUseCase', () => {
  test('trims title and description, removes empty tags, and returns the updated library video', async () => {
    const findLibraryVideoById = vi.fn(async () => ({
      createdAt: new Date('2026-03-27T00:00:00.000Z'),
      description: 'Original description',
      duration: 180,
      id: 'video-1',
      tags: ['Action'],
      title: 'Original title',
      videoUrl: '/videos/video-1/manifest.mpd',
    }));
    const updateLibraryVideo = vi.fn(async () => ({
      createdAt: new Date('2026-03-27T00:00:00.000Z'),
      description: 'Updated description',
      duration: 180,
      id: 'video-1',
      tags: ['Action', 'Neo'],
      title: 'Updated title',
      videoUrl: '/videos/video-1/manifest.mpd',
    }));
    const useCase = new UpdateLibraryVideoUseCase({
      videoMutation: {
        deleteLibraryVideo: vi.fn(),
        findLibraryVideoById,
        updateLibraryVideo,
      },
    });

    await expect(useCase.execute({
      description: '  Updated description  ',
      tags: [' Action ', '', 'Neo', '   '],
      title: '  Updated title  ',
      videoId: 'video-1',
    })).resolves.toEqual({
      data: {
        message: 'Video "Updated title" updated successfully',
        video: expect.objectContaining({
          description: 'Updated description',
          id: 'video-1',
          tags: ['Action', 'Neo'],
          title: 'Updated title',
        }),
      },
      ok: true,
    });

    expect(findLibraryVideoById).toHaveBeenCalledWith('video-1');
    expect(updateLibraryVideo).toHaveBeenCalledWith({
      description: 'Updated description',
      tags: ['Action', 'Neo'],
      title: 'Updated title',
      videoId: 'video-1',
    });
  });

  test('rejects invalid input before touching the mutation port', async () => {
    const findLibraryVideoById = vi.fn();
    const updateLibraryVideo = vi.fn();
    const useCase = new UpdateLibraryVideoUseCase({
      videoMutation: {
        deleteLibraryVideo: vi.fn(),
        findLibraryVideoById,
        updateLibraryVideo,
      },
    });

    await expect(useCase.execute({
      tags: ['Action'],
      title: '   ',
      videoId: '',
    })).resolves.toEqual({
      message: 'Video ID is required',
      ok: false,
      reason: 'INVALID_INPUT',
    });

    expect(findLibraryVideoById).not.toHaveBeenCalled();
    expect(updateLibraryVideo).not.toHaveBeenCalled();
  });

  test('returns VIDEO_NOT_FOUND when the canonical record does not exist', async () => {
    const findLibraryVideoById = vi.fn(async () => null);
    const updateLibraryVideo = vi.fn();
    const useCase = new UpdateLibraryVideoUseCase({
      videoMutation: {
        deleteLibraryVideo: vi.fn(),
        findLibraryVideoById,
        updateLibraryVideo,
      },
    });

    await expect(useCase.execute({
      description: 'Updated description',
      tags: ['Action'],
      title: 'Updated title',
      videoId: 'video-1',
    })).resolves.toEqual({
      message: 'Video not found',
      ok: false,
      reason: 'VIDEO_NOT_FOUND',
    });

    expect(updateLibraryVideo).not.toHaveBeenCalled();
  });

  test('rejects missing or non-string titles as INVALID_INPUT instead of throwing', async () => {
    const useCase = new UpdateLibraryVideoUseCase({
      videoMutation: {
        deleteLibraryVideo: vi.fn(),
        findLibraryVideoById: vi.fn(),
        updateLibraryVideo: vi.fn(),
      },
    });

    await expect(useCase.execute({
      tags: ['Action'],
      title: undefined,
      videoId: 'video-1',
    })).resolves.toEqual({
      message: 'Title is required',
      ok: false,
      reason: 'INVALID_INPUT',
    });

    await expect(useCase.execute({
      tags: ['Action'],
      title: 123 as never,
      videoId: 'video-1',
    })).resolves.toEqual({
      message: 'Title is required',
      ok: false,
      reason: 'INVALID_INPUT',
    });
  });
});
