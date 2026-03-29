import { describe, expect, test, vi } from 'vitest';
import type { IngestPreparedVideoWorkspacePort } from '../ports/ingest-prepared-video-workspace.port';
import type { IngestVideoProcessingPort } from '../ports/ingest-video-processing.port';
import { AddVideoToLibraryUseCase } from './add-video-to-library.usecase';

class RejectedAddToLibraryError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = 'RejectedAddToLibraryError';
  }
}

function createPreparedVideoWorkspace(input: {
  preparePreparedVideo: IngestPreparedVideoWorkspacePort['preparePreparedVideo'];
  recoverPreparedVideo?: IngestPreparedVideoWorkspacePort['recoverPreparedVideo'];
}): IngestPreparedVideoWorkspacePort {
  return {
    preparePreparedVideo: input.preparePreparedVideo,
    recoverPreparedVideo: input.recoverPreparedVideo ?? (async () => ({
      restoredThumbnail: true as const,
      retryAvailability: 'restored' as const,
    })),
  };
}

function createVideoProcessing(input: {
  finalizeSuccessfulVideo?: IngestVideoProcessingPort['finalizeSuccessfulVideo'];
  processPreparedVideo: IngestVideoProcessingPort['processPreparedVideo'];
}): IngestVideoProcessingPort {
  return {
    finalizeSuccessfulVideo: input.finalizeSuccessfulVideo ?? (async () => undefined),
    processPreparedVideo: input.processPreparedVideo,
  };
}

describe('AddVideoToLibraryUseCase', () => {
  test('processes the prepared video before writing metadata and then returns the preserved add-to-library success payload', async () => {
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
    const finalizeSuccessfulPreparedVideo = vi.fn(async () => {
      callOrder.push('finalize');
    });
    const useCase = new AddVideoToLibraryUseCase({
      preparedVideoWorkspace: createPreparedVideoWorkspace({
        preparePreparedVideo: prepareVideoForLibrary,
      }),
      videoProcessing: createVideoProcessing({
        finalizeSuccessfulVideo: finalizeSuccessfulPreparedVideo,
        processPreparedVideo,
      }),
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
    expect(finalizeSuccessfulPreparedVideo).toHaveBeenCalledOnce();
    expect(callOrder).toEqual(['prepare', 'process', 'write', 'finalize']);
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
      preparedVideoWorkspace: createPreparedVideoWorkspace({
        preparePreparedVideo: vi.fn(async () => {
          throw new RejectedAddToLibraryError('Title cannot be empty', 400);
        }),
      }),
      videoProcessing: createVideoProcessing({
        processPreparedVideo: vi.fn(),
      }),
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
      preparedVideoWorkspace: createPreparedVideoWorkspace({
        preparePreparedVideo: prepareVideoForLibrary,
      }),
      videoProcessing: createVideoProcessing({
        processPreparedVideo,
      }),
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
      preparedVideoWorkspace: createPreparedVideoWorkspace({
        preparePreparedVideo: prepareVideoForLibrary,
      }),
      videoProcessing: createVideoProcessing({
        processPreparedVideo,
      }),
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
      preparedVideoWorkspace: createPreparedVideoWorkspace({
        preparePreparedVideo: prepareVideoForLibrary,
      }),
      videoProcessing: createVideoProcessing({
        processPreparedVideo,
      }),
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

  test('returns unavailable, skips metadata persistence, and restores the upload when video conversion reports a failed result', async () => {
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: false,
      message: 'Video conversion failed',
    }));
    const recoverFailedPreparedVideo = vi.fn(async () => ({
      restoredThumbnail: true,
      retryAvailability: 'restored' as const,
    }));
    const writeVideoRecord = vi.fn(async () => undefined);
    const useCase = new AddVideoToLibraryUseCase({
      preparedVideoWorkspace: createPreparedVideoWorkspace({
        preparePreparedVideo: prepareVideoForLibrary,
        recoverPreparedVideo: recoverFailedPreparedVideo,
      }),
      videoProcessing: createVideoProcessing({
        processPreparedVideo,
      }),
      videoMetadataWriter: {
        writeVideoRecord,
      },
    });

    await expect(useCase.execute({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      tags: [],
    })).resolves.toEqual({
      ok: false,
      message: 'Video conversion failed. The upload was restored so you can retry.',
      reason: 'ADD_TO_LIBRARY_UNAVAILABLE',
    });
    expect(writeVideoRecord).not.toHaveBeenCalled();
    expect(recoverFailedPreparedVideo).toHaveBeenCalledWith({
      filename: 'fixture-video.mp4',
      videoId: expect.any(String),
    });
  });

  test('returns a recovery-aware unavailable message when processing throws after preparation', async () => {
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => {
      throw new Error('ffmpeg failed');
    });
    const recoverFailedPreparedVideo = vi.fn(async () => ({
      restoredThumbnail: true,
      retryAvailability: 'restored' as const,
    }));
    const writeVideoRecord = vi.fn(async () => undefined);
    const useCase = new AddVideoToLibraryUseCase({
      preparedVideoWorkspace: createPreparedVideoWorkspace({
        preparePreparedVideo: prepareVideoForLibrary,
        recoverPreparedVideo: recoverFailedPreparedVideo,
      }),
      videoProcessing: createVideoProcessing({
        processPreparedVideo,
      }),
      videoMetadataWriter: {
        writeVideoRecord,
      },
    });

    await expect(useCase.execute({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      tags: [],
    })).resolves.toEqual({
      ok: false,
      message: 'Video conversion failed. The upload was restored so you can retry.',
      reason: 'ADD_TO_LIBRARY_UNAVAILABLE',
    });
    expect(writeVideoRecord).not.toHaveBeenCalled();
    expect(recoverFailedPreparedVideo).toHaveBeenCalledWith({
      filename: 'fixture-video.mp4',
      videoId: expect.any(String),
    });
  });

  test('returns an unavailable failure that does not claim retry restoration when recovery reports the upload could not be restored', async () => {
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: false,
      message: 'Video conversion failed',
    }));
    const recoverFailedPreparedVideo = vi.fn(async () => ({
      restoredThumbnail: false,
      retryAvailability: 'unavailable' as const,
    }));
    const writeVideoRecord = vi.fn(async () => undefined);
    const useCase = new AddVideoToLibraryUseCase({
      preparedVideoWorkspace: createPreparedVideoWorkspace({
        preparePreparedVideo: prepareVideoForLibrary,
        recoverPreparedVideo: recoverFailedPreparedVideo,
      }),
      videoProcessing: createVideoProcessing({
        processPreparedVideo,
      }),
      videoMetadataWriter: {
        writeVideoRecord,
      },
    });

    await expect(useCase.execute({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      tags: [],
    })).resolves.toEqual({
      ok: false,
      message: 'Video conversion failed and the upload could not be restored automatically.',
      reason: 'ADD_TO_LIBRARY_UNAVAILABLE',
    });
    expect(writeVideoRecord).not.toHaveBeenCalled();
    expect(recoverFailedPreparedVideo).toHaveBeenCalledWith({
      filename: 'fixture-video.mp4',
      videoId: expect.any(String),
    });
  });

  test('returns a preparation-specific recovery-aware unavailable message when prepare fails after preserving retry availability', async () => {
    const prepareVideoForLibrary = vi.fn(async () => {
      throw Object.assign(new Error('ffprobe failed'), {
        recoveryResult: {
          restoredThumbnail: true,
          retryAvailability: 'already_available' as const,
        },
      });
    });
    const processPreparedVideo = vi.fn();
    const writeVideoRecord = vi.fn(async () => undefined);
    const useCase = new AddVideoToLibraryUseCase({
      preparedVideoWorkspace: createPreparedVideoWorkspace({
        preparePreparedVideo: prepareVideoForLibrary,
      }),
      videoProcessing: createVideoProcessing({
        processPreparedVideo,
      }),
      videoMetadataWriter: {
        writeVideoRecord,
      },
    });

    await expect(useCase.execute({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      tags: [],
    })).resolves.toEqual({
      ok: false,
      message: 'Video preparation failed. The upload is still available so you can retry.',
      reason: 'ADD_TO_LIBRARY_UNAVAILABLE',
    });
    expect(processPreparedVideo).not.toHaveBeenCalled();
    expect(writeVideoRecord).not.toHaveBeenCalled();
  });

  test('returns a metadata-specific recovery-aware unavailable message when metadata persistence throws after processing succeeds', async () => {
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
    }));
    const recoverFailedPreparedVideo = vi.fn(async () => ({
      restoredThumbnail: true,
      retryAvailability: 'restored' as const,
    }));
    const writeVideoRecord = vi.fn(async () => {
      throw new Error('sqlite failed');
    });
    const finalizeSuccessfulPreparedVideo = vi.fn(async () => undefined);
    const useCase = new AddVideoToLibraryUseCase({
      preparedVideoWorkspace: createPreparedVideoWorkspace({
        preparePreparedVideo: prepareVideoForLibrary,
        recoverPreparedVideo: recoverFailedPreparedVideo,
      }),
      videoProcessing: createVideoProcessing({
        finalizeSuccessfulVideo: finalizeSuccessfulPreparedVideo,
        processPreparedVideo,
      }),
      videoMetadataWriter: {
        writeVideoRecord,
      },
    });

    await expect(useCase.execute({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      tags: [],
    })).resolves.toEqual({
      ok: false,
      message: 'Video metadata could not be saved. The upload was restored so you can retry.',
      reason: 'ADD_TO_LIBRARY_UNAVAILABLE',
    });
    expect(recoverFailedPreparedVideo).toHaveBeenCalledWith({
      filename: 'fixture-video.mp4',
      videoId: expect.any(String),
    });
    expect(finalizeSuccessfulPreparedVideo).not.toHaveBeenCalled();
  });
});
