import { describe, expect, test, vi } from 'vitest';
import { createUploadCommitAction } from '../../../app/routes/api.uploads.$stagingId.commit';

describe('upload commit api route', () => {
  test('commits a staged upload without forwarding stale encoding options', async () => {
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
          contentTypeSlug: 'movie',
          description: 'A test upload',
          encodingOptions: {
            encoder: 'gpu-h265',
          },
          genreSlugs: ['documentary'],
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
      contentTypeSlug: 'movie',
      description: 'A test upload',
      genreSlugs: ['documentary'],
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

  test('accepts malformed legacy encoding options without letting them affect the command', async () => {
    const execute = vi.fn(async () => ({
      ok: true as const,
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with media preparation',
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
          encodingOptions: {
            encoder: ['not-valid'],
          },
          tags: [],
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(200);
    expect(execute).toHaveBeenCalledWith({
      genreSlugs: [],
      stagingId: 'staging-123',
      tags: [],
      title: 'Fixture Video',
    });
  });

  test('rejects unauthenticated commit requests before reading ingest services', async () => {
    const getServerIngestServices = vi.fn();
    const action = createUploadCommitAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices,
      requireProtectedApiSession: vi.fn(async () => new Response('Unauthorized', { status: 401 })),
    });

    const response = await action({
      params: {
        stagingId: 'staging-123',
      },
      request: new Request('http://localhost/api/uploads/staging-123/commit', {
        body: JSON.stringify({
          tags: [],
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(401);
    expect(getServerIngestServices).not.toHaveBeenCalled();
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

  test('ignores invalid optional metadata instead of forwarding non-string values to the use case', async () => {
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
          contentTypeSlug: { slug: 'movie' },
          genreSlugs: ['documentary', 42, null],
          tags: ['fixture', false],
          title: 'Fixture Video',
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(200);
    expect(execute).toHaveBeenCalledWith({
      genreSlugs: ['documentary'],
      stagingId: 'staging-123',
      tags: ['fixture'],
      title: 'Fixture Video',
    });
  });
});
