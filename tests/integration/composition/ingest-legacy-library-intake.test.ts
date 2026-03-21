import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ValidationError } from '~/legacy/lib/errors';

const executeMock = vi.fn();
const createAddVideoUseCaseMock = vi.fn(() => ({
  execute: executeMock,
}));

describe('ingest legacy library intake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('maps legacy add-video success into the canonical ingest success result', async () => {
    executeMock.mockResolvedValue({
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        videoId: 'video-123',
      },
      success: true,
    });

    const { createIngestLegacyLibraryIntake } = await import('../../../app/composition/server/ingest-legacy-library-intake');
    const intake = createIngestLegacyLibraryIntake({
      createAddVideoUseCase: createAddVideoUseCaseMock,
    });
    const result = await intake.addVideoToLibrary({
      description: 'A test video',
      encodingOptions: {
        encoder: 'cpu-h264',
      },
      filename: 'fixture-video.mp4',
      tags: ['fixture', 'test'],
      title: 'Fixture Video',
    });

    expect(createAddVideoUseCaseMock).toHaveBeenCalledOnce();
    expect(executeMock).toHaveBeenCalledWith({
      description: 'A test video',
      encodingOptions: {
        encoder: 'cpu-h264',
      },
      filename: 'fixture-video.mp4',
      tags: ['fixture', 'test'],
      title: 'Fixture Video',
    });
    expect(result).toEqual({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
      videoId: 'video-123',
    });
  });

  test('maps legacy add-video failures into canonical ingest rejection results', async () => {
    executeMock.mockResolvedValue({
      error: new ValidationError('Title cannot be empty'),
      success: false,
    });

    const { createIngestLegacyLibraryIntake } = await import('../../../app/composition/server/ingest-legacy-library-intake');
    const intake = createIngestLegacyLibraryIntake({
      createAddVideoUseCase: createAddVideoUseCaseMock,
    });

    await expect(intake.addVideoToLibrary({
      filename: 'fixture-video.mp4',
      tags: [],
      title: '',
    })).rejects.toThrow('Title cannot be empty');
  });
});
