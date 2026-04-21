import { describe, expect, test, vi } from 'vitest';
import { createUploadsAction } from '../../../app/routes/api.uploads';

describe('uploads api route', () => {
  test('streams the request through the upload adapter and returns the staged upload payload', async () => {
    const requireProtectedApiSession = vi.fn(async () => null);
    const receiveSingleFileUpload = vi.fn(async () => ({
      filename: 'fixture-video.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      tempFilePath: '/tmp/request-123/fixture-video.mp4',
    }));
    const execute = vi.fn(async () => ({
      ok: true as const,
      data: {
        filename: 'fixture-video.mp4',
        mimeType: 'video/mp4',
        size: 1_024,
        stagingId: 'staging-123',
      },
    }));
    const action = createUploadsAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        startStagedUpload: {
          execute,
        },
        uploadBrowserFile: {
          receiveSingleFileUpload,
        },
      }),
      requireProtectedApiSession,
    });

    const response = await action({
      request: new Request('http://localhost/api/uploads', {
        body: 'upload-body',
        method: 'POST',
      }),
    } as never);

    expect(requireProtectedApiSession).toHaveBeenCalledOnce();
    expect(receiveSingleFileUpload).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledWith({
      filename: 'fixture-video.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      tempFilePath: '/tmp/request-123/fixture-video.mp4',
    });
    await expect((response as Response).json()).resolves.toEqual({
      filename: 'fixture-video.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'staging-123',
      success: true,
    });
  });

  test('returns the auth gate response without reading the request body when unauthorized', async () => {
    const requireProtectedApiSession = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    const receiveSingleFileUpload = vi.fn();
    const execute = vi.fn();
    const action = createUploadsAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        startStagedUpload: {
          execute,
        },
        uploadBrowserFile: {
          receiveSingleFileUpload,
        },
      }),
      requireProtectedApiSession,
    });

    const response = await action({
      request: new Request('http://localhost/api/uploads', {
        method: 'POST',
      }),
    } as never);

    expect((response as Response).status).toBe(401);
    expect(receiveSingleFileUpload).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });
});
