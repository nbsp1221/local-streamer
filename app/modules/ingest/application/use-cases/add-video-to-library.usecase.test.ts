import { describe, expect, test, vi } from 'vitest';
import { AddVideoToLibraryUseCase } from './add-video-to-library.usecase';

class RejectedAddToLibraryError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'RejectedAddToLibraryError';
  }
}

describe('AddVideoToLibraryUseCase', () => {
  test('creates the canonical video record, writes metadata, and then returns the preserved add-to-library success payload', async () => {
    const callOrder: string[] = [];
    const prepareVideoForLibrary = vi.fn(async () => {
      callOrder.push('prepare');
      return {
        duration: 120,
        sourcePath: '/workspace/video.mp4',
      };
    });
    const processPreparedVideo = vi.fn(async () => {
      callOrder.push('process');
      return {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
      };
    });
    const writeVideoRecord = vi.fn(async (record) => {
      callOrder.push('write');
      return record;
    });
    const useCase = new AddVideoToLibraryUseCase({
      libraryIntake: {
        prepareVideoForLibrary,
        processPreparedVideo,
      },
      videoMetadataWriter: {
        writeVideoRecord,
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

    expect(prepareVideoForLibrary).toHaveBeenCalledOnce();
    expect(writeVideoRecord).toHaveBeenCalledOnce();
    expect(processPreparedVideo).toHaveBeenCalledOnce();
    expect(callOrder).toEqual(['prepare', 'write', 'process']);
    expect(writeVideoRecord).toHaveBeenCalledWith(expect.objectContaining({
      description: 'A test video',
      duration: 120,
      id: expect.any(String),
      tags: ['fixture', 'test'],
      thumbnailUrl: expect.stringMatching(/^\/api\/thumbnail\//),
      title: 'Fixture Video',
      videoUrl: expect.stringMatching(/^\/videos\/.*\/manifest\.mpd$/),
    }));
    expect(result).toEqual({
      ok: true,
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        videoId: expect.any(String),
      },
    });
  });

  test('returns the explicit canonical failure payload from the source port without data loss', async () => {
    const useCase = new AddVideoToLibraryUseCase({
      libraryIntake: {
        prepareVideoForLibrary: vi.fn(async () => {
          throw new RejectedAddToLibraryError('Title cannot be empty', 400);
        }),
        processPreparedVideo: vi.fn(),
      },
      videoMetadataWriter: {
        writeVideoRecord: vi.fn(),
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

  test('rejects an empty trimmed title before touching filesystem or metadata dependencies', async () => {
    const prepareVideoForLibrary = vi.fn();
    const processPreparedVideo = vi.fn();
    const writeVideoRecord = vi.fn();
    const useCase = new AddVideoToLibraryUseCase({
      libraryIntake: {
        prepareVideoForLibrary,
        processPreparedVideo,
      },
      videoMetadataWriter: {
        writeVideoRecord,
      },
    });

    await expect(useCase.execute({
      filename: 'fixture-video.mp4',
      title: '   ',
      tags: [],
    })).resolves.toEqual({
      ok: false,
      message: 'Title cannot be empty',
      reason: 'ADD_TO_LIBRARY_REJECTED',
    });
    expect(prepareVideoForLibrary).not.toHaveBeenCalled();
    expect(writeVideoRecord).not.toHaveBeenCalled();
    expect(processPreparedVideo).not.toHaveBeenCalled();
  });

  test('normalizes missing tags to an empty array before touching metadata and processing dependencies', async () => {
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
    }));
    const writeVideoRecord = vi.fn(async () => undefined);
    const useCase = new AddVideoToLibraryUseCase({
      libraryIntake: {
        prepareVideoForLibrary,
        processPreparedVideo,
      },
      videoMetadataWriter: {
        writeVideoRecord,
      },
    });

    await expect(useCase.execute({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
    } as never)).resolves.toEqual({
      ok: true,
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        videoId: expect.any(String),
      },
    });
    expect(writeVideoRecord).toHaveBeenCalledWith(expect.objectContaining({
      tags: [],
      title: 'Fixture Video',
    }));
  });

  test('rejects a malformed command with a non-array tags value before touching filesystem or metadata dependencies', async () => {
    const prepareVideoForLibrary = vi.fn();
    const processPreparedVideo = vi.fn();
    const writeVideoRecord = vi.fn();
    const useCase = new AddVideoToLibraryUseCase({
      libraryIntake: {
        prepareVideoForLibrary,
        processPreparedVideo,
      },
      videoMetadataWriter: {
        writeVideoRecord,
      },
    });

    await expect(useCase.execute({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      tags: 'fixture',
    } as never)).resolves.toEqual({
      ok: false,
      message: 'Tags must be an array',
      reason: 'ADD_TO_LIBRARY_REJECTED',
    });
    expect(prepareVideoForLibrary).not.toHaveBeenCalled();
    expect(writeVideoRecord).not.toHaveBeenCalled();
    expect(processPreparedVideo).not.toHaveBeenCalled();
  });
});
