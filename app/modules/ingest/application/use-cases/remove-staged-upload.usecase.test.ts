import { describe, expect, test, vi } from 'vitest';
import { RemoveStagedUploadUseCase } from './remove-staged-upload.usecase';

describe('RemoveStagedUploadUseCase', () => {
  test('deletes an uploaded staged file and its row', async () => {
    const deleteStorage = vi.fn(async () => undefined);
    const deleteRow = vi.fn(async () => undefined);
    const useCase = new RemoveStagedUploadUseCase({
      stagedUploadRepository: {
        beginCommit: vi.fn(),
        create: vi.fn(),
        delete: deleteRow,
        findByStagingId: vi.fn(async () => ({
          createdAt: new Date('2026-04-20T00:00:00.000Z'),
          expiresAt: new Date('2026-04-21T00:00:00.000Z'),
          filename: 'fixture-video.mp4',
          mimeType: 'video/mp4',
          size: 1_024,
          stagingId: 'staging-123',
          status: 'uploaded' as const,
          storagePath: '/tmp/staging-123/video.mp4',
        })),
        listExpired: vi.fn(),
        reserveCommittedVideoId: vi.fn(),
        update: vi.fn(),
      },
      stagedUploadStorage: {
        delete: deleteStorage,
        deleteTemp: vi.fn(),
        promote: vi.fn(),
      },
    });

    await expect(useCase.execute({
      stagingId: 'staging-123',
    })).resolves.toEqual({
      ok: true,
    });
    expect(deleteStorage).toHaveBeenCalledWith('/tmp/staging-123/video.mp4');
    expect(deleteRow).toHaveBeenCalledWith('staging-123');
  });

  test('returns a conflict when the staged upload is already committing', async () => {
    const deleteStorage = vi.fn();
    const deleteRow = vi.fn();
    const useCase = new RemoveStagedUploadUseCase({
      stagedUploadRepository: {
        beginCommit: vi.fn(),
        create: vi.fn(),
        delete: deleteRow,
        findByStagingId: vi.fn(async () => ({
          createdAt: new Date('2026-04-20T00:00:00.000Z'),
          expiresAt: new Date('2026-04-21T00:00:00.000Z'),
          filename: 'fixture-video.mp4',
          mimeType: 'video/mp4',
          size: 1_024,
          stagingId: 'staging-123',
          status: 'committing' as const,
          storagePath: '/tmp/staging-123/video.mp4',
        })),
        listExpired: vi.fn(),
        reserveCommittedVideoId: vi.fn(),
        update: vi.fn(),
      },
      stagedUploadStorage: {
        delete: deleteStorage,
        deleteTemp: vi.fn(),
        promote: vi.fn(),
      },
    });

    await expect(useCase.execute({
      stagingId: 'staging-123',
    })).resolves.toEqual({
      ok: false,
      message: 'Commit already in progress',
      reason: 'REMOVE_STAGED_UPLOAD_CONFLICT',
    });
    expect(deleteStorage).not.toHaveBeenCalled();
    expect(deleteRow).not.toHaveBeenCalled();
  });
});
