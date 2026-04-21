import { describe, expect, test, vi } from 'vitest';
import { createUploadCommitAction } from '../../../app/routes/api.uploads.$stagingId.commit';

describe('upload commit api route', () => {
  test('commits a staged upload and preserves the success contract', async () => {
    const execute = vi.fn(async () => ({
      ok: true as const,
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        videoId: 'video-123',
      },
    }));
    const action = createUploadCommitAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        commitStagedUploadToLibrary: {
          execute,
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

    const response = await action({
      params: {
        stagingId: 'staging-123',
      },
      request: new Request('http://localhost/api/uploads/staging-123/commit', {
        body: JSON.stringify({
          description: 'A test upload',
          encodingOptions: {
            encoder: 'cpu-h264',
          },
          tags: ['fixture'],
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect(execute).toHaveBeenCalledWith({
      description: 'A test upload',
      encodingOptions: {
        encoder: 'cpu-h264',
      },
      stagingId: 'staging-123',
      tags: ['fixture'],
      title: 'Fixture Video',
    });
    await expect((response as Response).json()).resolves.toEqual({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
      success: true,
      videoId: 'video-123',
    });
  });

  test('maps validation failures to 400', async () => {
    const execute = vi.fn(async () => ({
      ok: false as const,
      message: 'Title cannot be empty',
      reason: 'COMMIT_STAGED_UPLOAD_REJECTED' as const,
    }));
    const action = createUploadCommitAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        commitStagedUploadToLibrary: {
          execute,
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

    const response = await action({
      params: {
        stagingId: 'staging-123',
      },
      request: new Request('http://localhost/api/uploads/staging-123/commit', {
        body: JSON.stringify({
          tags: [],
          title: '   ',
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
});
