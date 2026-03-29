import { describe, expect, test, vi } from 'vitest';
import type { IngestPendingVideo } from '../../domain/ingest-pending-video';
import { LoadPendingUploadSnapshotUseCase } from './load-pending-upload-snapshot.usecase';

function createPendingUpload(overrides: Partial<IngestPendingVideo> = {}): IngestPendingVideo {
  return {
    createdAt: new Date('2026-03-29T00:00:00.000Z'),
    filename: 'fixture-video.mp4',
    id: 'fixture-video',
    size: 1_024,
    thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
    type: 'video/mp4',
    ...overrides,
  };
}

describe('LoadPendingUploadSnapshotUseCase', () => {
  test('returns the full pending-upload snapshot with a derived count', async () => {
    const files = [
      createPendingUpload(),
      createPendingUpload({
        filename: 'second-video.mov',
        id: 'second-video',
      }),
    ];
    const readPendingUploads = vi.fn(async () => files);
    const useCase = new LoadPendingUploadSnapshotUseCase({
      pendingVideoReader: {
        readPendingUploads,
      },
    });

    const result = await useCase.execute();

    expect(readPendingUploads).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      data: {
        count: 2,
        files,
      },
    });

    if (!result.ok) {
      throw new Error('Expected a successful pending-upload snapshot result');
    }

    expect(result.data.files[0]?.createdAt).toBeInstanceOf(Date);
  });

  test('returns an explicit unavailable reason when the reader throws', async () => {
    const useCase = new LoadPendingUploadSnapshotUseCase({
      pendingVideoReader: {
        readPendingUploads: vi.fn(async () => {
          throw new Error('pending uploads unavailable');
        }),
      },
    });

    await expect(useCase.execute()).resolves.toEqual({
      ok: false,
      reason: 'PENDING_UPLOAD_SNAPSHOT_UNAVAILABLE',
    });
  });
});
