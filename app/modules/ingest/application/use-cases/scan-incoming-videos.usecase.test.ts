import { describe, expect, test, vi } from 'vitest';
import type { IngestPendingVideo } from '../../domain/ingest-pending-video';
import { ScanIncomingVideosUseCase } from './scan-incoming-videos.usecase';

function createPendingVideo(overrides: Partial<IngestPendingVideo> = {}): IngestPendingVideo {
  return {
    createdAt: new Date('2026-03-17T00:00:00.000Z'),
    filename: 'fixture-video.mp4',
    id: 'fixture-video',
    size: 1_024,
    thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
    type: 'mp4',
    ...overrides,
  };
}

describe('ScanIncomingVideosUseCase', () => {
  test('returns the full canonical pending video collection with a derived count', async () => {
    const files = [
      createPendingVideo(),
      createPendingVideo({
        filename: 'second-video.mov',
        id: 'second-video',
        size: 2_048,
        thumbnailUrl: '/api/thumbnail-preview/second-video.jpg',
        type: 'mov',
      }),
    ];
    const scanIncomingVideos = vi.fn(async () => files);
    const useCase = new ScanIncomingVideosUseCase({
      incomingVideoSource: {
        scanIncomingVideos,
      },
    });

    const result = await useCase.execute();

    expect(scanIncomingVideos).toHaveBeenCalledOnce();
    expect(result).toEqual({
      ok: true,
      data: {
        count: 2,
        files,
      },
    });

    if (!result.ok) {
      throw new Error('Expected successful incoming scan result');
    }

    expect(result.data.files[0]?.createdAt).toBeInstanceOf(Date);
  });

  test('returns an explicit unavailable reason when the source port throws', async () => {
    const useCase = new ScanIncomingVideosUseCase({
      incomingVideoSource: {
        scanIncomingVideos: vi.fn(async () => {
          throw new Error('uploads unavailable');
        }),
      },
    });

    await expect(useCase.execute()).resolves.toEqual({
      ok: false,
      reason: 'INCOMING_SCAN_UNAVAILABLE',
    });
  });
});
