import { describe, expect, test, vi } from 'vitest';
import { AddVideoToLibraryUseCase } from './add-video-to-library.usecase';

class RejectedAddToLibraryError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'RejectedAddToLibraryError';
  }
}

describe('AddVideoToLibraryUseCase', () => {
  test('returns the canonical add-to-library success payload without data loss', async () => {
    const addVideoToLibrary = vi.fn(async () => ({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
      videoId: 'video-123',
    }));
    const useCase = new AddVideoToLibraryUseCase({
      libraryIntake: {
        addVideoToLibrary,
      },
    });

    const command = {
      description: 'A test video',
      encodingOptions: {
        encoder: 'cpu-h264' as const,
      },
      filename: 'fixture-video.mp4',
      tags: ['fixture', 'test'],
      title: 'Fixture Video',
    };
    const result = await useCase.execute(command);

    expect(addVideoToLibrary).toHaveBeenCalledOnce();
    expect(addVideoToLibrary).toHaveBeenCalledWith(command);
    expect(result).toEqual({
      ok: true,
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        videoId: 'video-123',
      },
    });
  });

  test('returns the explicit canonical failure payload from the source port without data loss', async () => {
    const useCase = new AddVideoToLibraryUseCase({
      libraryIntake: {
        addVideoToLibrary: vi.fn(async () => {
          throw new RejectedAddToLibraryError('Title cannot be empty', 400);
        }),
      },
    });

    await expect(useCase.execute({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      tags: [],
    })).resolves.toEqual({
      ok: false,
      message: 'Title cannot be empty',
      reason: 'ADD_TO_LIBRARY_REJECTED',
    });
  });
});
