import { describe, expect, test, vi } from 'vitest';
import type { IngestPreparedVideoWorkspacePort } from '../../../app/modules/ingest/application/ports/ingest-prepared-video-workspace.port';
import type { IngestVideoProcessingPort } from '../../../app/modules/ingest/application/ports/ingest-video-processing.port';
import { AddVideoToLibraryUseCase } from '../../../app/modules/ingest/application/use-cases/add-video-to-library.usecase';
import { createAddToLibraryAction } from '../../../app/routes/api.add-to-library';

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

describe('add to library api route', () => {
  test('loads the add-to-library command through the ingest composition root and preserves the success contract', async () => {
    const requireProtectedApiSession = vi.fn(async () => null);
    const execute = vi.fn(async () => ({
      ok: true as const,
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        videoId: 'video-123',
      },
    }));
    const action = createAddToLibraryAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        addVideoToLibrary: {
          execute,
        },
        scanIncomingVideos: {
          execute: vi.fn(),
        },
      }),
      requireProtectedApiSession,
    });

    const response = await action({
      request: new Request('http://localhost/api/add-to-library', {
        body: JSON.stringify({
          description: 'A test video',
          encodingOptions: {
            encoder: 'cpu-h264',
          },
          filename: 'fixture-video.mp4',
          tags: ['fixture', 'test'],
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect(requireProtectedApiSession).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith({
      description: 'A test video',
      encodingOptions: {
        encoder: 'cpu-h264',
      },
      filename: 'fixture-video.mp4',
      tags: ['fixture', 'test'],
      title: 'Fixture Video',
    });
    await expect((response as Response).json()).resolves.toEqual({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
      success: true,
      videoId: 'video-123',
    });
  });

  test('preserves the current failure contract when ingest rejects the add-to-library request', async () => {
    const execute = vi.fn(async () => ({
      ok: false as const,
      message: 'Title cannot be empty',
      reason: 'ADD_TO_LIBRARY_REJECTED' as const,
    }));
    const action = createAddToLibraryAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        addVideoToLibrary: {
          execute,
        },
        scanIncomingVideos: {
          execute: vi.fn(),
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

    const response = await action({
      request: new Request('http://localhost/api/add-to-library', {
        body: JSON.stringify({
          filename: 'fixture-video.mp4',
          tags: [],
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(400);
    await expect((response as Response).json()).resolves.toEqual({
      error: 'Title cannot be empty',
      success: false,
    });
  });

  test('returns the auth gate response without touching ingest services when the request is unauthorized', async () => {
    const requireProtectedApiSession = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    const execute = vi.fn();
    const action = createAddToLibraryAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        addVideoToLibrary: {
          execute,
        },
        scanIncomingVideos: {
          execute: vi.fn(),
        },
      }),
      requireProtectedApiSession,
    });

    const response = await action({
      request: new Request('http://localhost/api/add-to-library', {
        body: JSON.stringify({
          filename: 'fixture-video.mp4',
          tags: [],
          title: 'Fixture Video',
        }),
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(401);
    await expect((response as Response).text()).resolves.toBe('unauthorized');
    expect(execute).not.toHaveBeenCalled();
  });

  test('normalizes omitted tags to an empty list instead of returning a 500', async () => {
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
    }));
    const finalizeSuccessfulPreparedVideo = vi.fn(async () => undefined);
    const writeVideoRecord = vi.fn(async () => undefined);
    const action = createAddToLibraryAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        addVideoToLibrary: new AddVideoToLibraryUseCase({
          preparedVideoWorkspace: createPreparedVideoWorkspace({
            preparePreparedVideo: prepareVideoForLibrary,
          }),
          videoMetadataWriter: {
            writeVideoRecord,
          },
          videoProcessing: createVideoProcessing({
            finalizeSuccessfulVideo: finalizeSuccessfulPreparedVideo,
            processPreparedVideo,
          }),
        }),
        scanIncomingVideos: {
          execute: vi.fn(),
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

    const response = await action({
      request: new Request('http://localhost/api/add-to-library', {
        body: JSON.stringify({
          filename: 'fixture-video.mp4',
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(200);
    await expect((response as Response).json()).resolves.toEqual({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
      success: true,
      videoId: expect.any(String),
    });
    expect(writeVideoRecord).toHaveBeenCalledWith(expect.objectContaining({
      tags: [],
      title: 'Fixture Video',
    }));
  });

  test('returns 500 and preserves the pending upload when processing fails before DASH packaging completes', async () => {
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: false,
      message: 'Video conversion failed',
    }));
    const finalizeSuccessfulPreparedVideo = vi.fn(async () => undefined);
    const recoverFailedPreparedVideo = vi.fn(async () => ({
      restoredThumbnail: true,
      retryAvailability: 'restored' as const,
    }));
    const writeVideoRecord = vi.fn(async () => undefined);
    const action = createAddToLibraryAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        addVideoToLibrary: new AddVideoToLibraryUseCase({
          preparedVideoWorkspace: createPreparedVideoWorkspace({
            preparePreparedVideo: prepareVideoForLibrary,
            recoverPreparedVideo: recoverFailedPreparedVideo,
          }),
          videoMetadataWriter: {
            writeVideoRecord,
          },
          videoProcessing: createVideoProcessing({
            finalizeSuccessfulVideo: finalizeSuccessfulPreparedVideo,
            processPreparedVideo,
          }),
        }),
        scanIncomingVideos: {
          execute: vi.fn(),
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

    const response = await action({
      request: new Request('http://localhost/api/add-to-library', {
        body: JSON.stringify({
          filename: 'fixture-video.mp4',
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(500);
    await expect((response as Response).json()).resolves.toEqual({
      error: 'Video conversion failed. The upload was restored so you can retry.',
      success: false,
    });
    expect(writeVideoRecord).not.toHaveBeenCalled();
    expect(recoverFailedPreparedVideo).toHaveBeenCalledWith({
      filename: 'fixture-video.mp4',
      videoId: expect.any(String),
    });
  });

  test('returns the recovery-aware 500 contract when processing throws after preparation', async () => {
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => {
      throw new Error('ffmpeg failed');
    });
    const finalizeSuccessfulPreparedVideo = vi.fn(async () => undefined);
    const recoverFailedPreparedVideo = vi.fn(async () => ({
      restoredThumbnail: true,
      retryAvailability: 'restored' as const,
    }));
    const writeVideoRecord = vi.fn(async () => undefined);
    const action = createAddToLibraryAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        addVideoToLibrary: new AddVideoToLibraryUseCase({
          preparedVideoWorkspace: createPreparedVideoWorkspace({
            preparePreparedVideo: prepareVideoForLibrary,
            recoverPreparedVideo: recoverFailedPreparedVideo,
          }),
          videoMetadataWriter: {
            writeVideoRecord,
          },
          videoProcessing: createVideoProcessing({
            finalizeSuccessfulVideo: finalizeSuccessfulPreparedVideo,
            processPreparedVideo,
          }),
        }),
        scanIncomingVideos: {
          execute: vi.fn(),
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

    const response = await action({
      request: new Request('http://localhost/api/add-to-library', {
        body: JSON.stringify({
          filename: 'fixture-video.mp4',
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(500);
    await expect((response as Response).json()).resolves.toEqual({
      error: 'Video conversion failed. The upload was restored so you can retry.',
      success: false,
    });
    expect(writeVideoRecord).not.toHaveBeenCalled();
    expect(recoverFailedPreparedVideo).toHaveBeenCalledWith({
      filename: 'fixture-video.mp4',
      videoId: expect.any(String),
    });
    expect(finalizeSuccessfulPreparedVideo).not.toHaveBeenCalled();
  });

  test('returns a metadata-specific 500 contract when metadata persistence fails after processing succeeds', async () => {
    const prepareVideoForLibrary = vi.fn(async () => ({
      duration: 120,
      sourcePath: '/workspace/video.mp4',
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
    }));
    const finalizeSuccessfulPreparedVideo = vi.fn(async () => undefined);
    const recoverFailedPreparedVideo = vi.fn(async () => ({
      restoredThumbnail: true,
      retryAvailability: 'restored' as const,
    }));
    const writeVideoRecord = vi.fn(async () => {
      throw new Error('sqlite failed');
    });
    const action = createAddToLibraryAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        addVideoToLibrary: new AddVideoToLibraryUseCase({
          preparedVideoWorkspace: createPreparedVideoWorkspace({
            preparePreparedVideo: prepareVideoForLibrary,
            recoverPreparedVideo: recoverFailedPreparedVideo,
          }),
          videoMetadataWriter: {
            writeVideoRecord,
          },
          videoProcessing: createVideoProcessing({
            finalizeSuccessfulVideo: finalizeSuccessfulPreparedVideo,
            processPreparedVideo,
          }),
        }),
        scanIncomingVideos: {
          execute: vi.fn(),
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

    const response = await action({
      request: new Request('http://localhost/api/add-to-library', {
        body: JSON.stringify({
          filename: 'fixture-video.mp4',
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(500);
    await expect((response as Response).json()).resolves.toEqual({
      error: 'Video metadata could not be saved. The upload was restored so you can retry.',
      success: false,
    });
    expect(recoverFailedPreparedVideo).toHaveBeenCalledWith({
      filename: 'fixture-video.mp4',
      videoId: expect.any(String),
    });
    expect(finalizeSuccessfulPreparedVideo).not.toHaveBeenCalled();
  });

  test('maps non-array tags into the current failure contract instead of a 500', async () => {
    const action = createAddToLibraryAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        addVideoToLibrary: new AddVideoToLibraryUseCase({
          preparedVideoWorkspace: createPreparedVideoWorkspace({
            preparePreparedVideo: vi.fn(),
          }),
          videoMetadataWriter: {
            writeVideoRecord: vi.fn(),
          },
          videoProcessing: createVideoProcessing({
            finalizeSuccessfulVideo: vi.fn(async () => undefined),
            processPreparedVideo: vi.fn(),
          }),
        }),
        scanIncomingVideos: {
          execute: vi.fn(),
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

    const response = await action({
      request: new Request('http://localhost/api/add-to-library', {
        body: JSON.stringify({
          filename: 'fixture-video.mp4',
          tags: 'fixture',
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(400);
    await expect((response as Response).json()).resolves.toEqual({
      error: 'Tags must be an array',
      success: false,
    });
  });
});
