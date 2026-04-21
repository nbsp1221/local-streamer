import { describe, expect, test, vi } from 'vitest';
import { createUploadRemoveAction } from '../../../app/routes/api.uploads.$stagingId';

describe('upload remove api route', () => {
  test('removes a staged upload through the ingest composition root', async () => {
    const execute = vi.fn(async () => ({
      ok: true as const,
    }));
    const action = createUploadRemoveAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        removeStagedUpload: {
          execute,
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

    const response = await action({
      params: {
        stagingId: 'staging-123',
      },
      request: new Request('http://localhost/api/uploads/staging-123', {
        method: 'DELETE',
      }),
    } as never);

    expect(execute).toHaveBeenCalledWith({
      stagingId: 'staging-123',
    });
    expect((response as Response).status).toBe(204);
  });

  test('maps a committing row to 409 conflict', async () => {
    const execute = vi.fn(async () => ({
      ok: false as const,
      message: 'Commit already in progress',
      reason: 'REMOVE_STAGED_UPLOAD_CONFLICT' as const,
    }));
    const action = createUploadRemoveAction({
      createErrorResponse: error => new Response(error instanceof Error ? error.message : 'Unknown error occurred', { status: 500 }),
      getServerIngestServices: () => ({
        removeStagedUpload: {
          execute,
        },
      }),
      requireProtectedApiSession: vi.fn(async () => null),
    });

    const response = await action({
      params: {
        stagingId: 'staging-123',
      },
      request: new Request('http://localhost/api/uploads/staging-123', {
        method: 'DELETE',
      }),
    } as never);

    expect((response as Response).status).toBe(409);
    await expect((response as Response).json()).resolves.toEqual({
      error: 'Commit already in progress',
      success: false,
    });
  });
});
