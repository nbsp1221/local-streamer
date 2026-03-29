import { describe, expect, test, vi } from 'vitest';
import type { IngestPendingVideo } from '../../domain/ingest-pending-video';
import { ScanIncomingVideosUseCase } from './scan-incoming-videos.usecase';

function createRawPendingUpload(overrides: Partial<Pick<IngestPendingVideo, 'createdAt' | 'filename' | 'id' | 'size' | 'type'>> = {}) {
  return {
    createdAt: new Date('2026-03-17T00:00:00.000Z'),
    filename: 'fixture-video.mp4',
    id: 'fixture-video',
    size: 1_024,
    type: 'mp4',
    ...overrides,
  };
}

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
  test('returns the enriched canonical pending video collection with a derived count', async () => {
    const rawUploads = [
      createRawPendingUpload(),
      createRawPendingUpload({
        filename: 'second-video.mov',
        id: 'second-video',
        size: 2_048,
        type: 'mov',
      }),
    ];
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
    const discoverUploads = vi.fn(async () => rawUploads);
    const enrichPendingUploads = vi.fn(async () => files);
    const useCase = new ScanIncomingVideosUseCase({
      pendingThumbnailEnricher: {
        enrichPendingUploads,
      },
      uploadScan: {
        discoverUploads,
      },
    });

    const result = await useCase.execute();

    expect(discoverUploads).toHaveBeenCalledOnce();
    expect(enrichPendingUploads).toHaveBeenCalledOnce();
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

  test('returns an explicit unavailable reason when upload discovery throws', async () => {
    const useCase = new ScanIncomingVideosUseCase({
      pendingThumbnailEnricher: {
        enrichPendingUploads: vi.fn(async () => []),
      },
      uploadScan: {
        discoverUploads: vi.fn(async () => {
          throw new Error('uploads unavailable');
        }),
      },
    });

    await expect(useCase.execute()).resolves.toEqual({
      ok: false,
      reason: 'INCOMING_SCAN_UNAVAILABLE',
    });
  });

  test('returns an explicit unavailable reason when thumbnail enrichment throws', async () => {
    const useCase = new ScanIncomingVideosUseCase({
      pendingThumbnailEnricher: {
        enrichPendingUploads: vi.fn(async () => {
          throw new Error('thumbnail enrichment unavailable');
        }),
      },
      uploadScan: {
        discoverUploads: vi.fn(async () => [createRawPendingUpload()]),
      },
    });

    await expect(useCase.execute()).resolves.toEqual({
      ok: false,
      reason: 'INCOMING_SCAN_UNAVAILABLE',
    });
  });
});
