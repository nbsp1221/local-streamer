import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TranscodingEngineError } from '../../../../app/legacy/lib/errors';

describe('FfmpegIngestVideoProcessingAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('processPreparedVideo maps encoding options through the current ingest processing policy', async () => {
    const transcode = vi.fn(async () => ({
      data: {
        duration: 120,
        manifestPath: '/storage/data/videos/video-123/manifest.mpd',
        thumbnailPath: '/storage/data/videos/video-123/thumbnail.jpg',
        videoId: 'video-123',
      },
      success: true as const,
    }));
    const { FfmpegIngestVideoProcessingAdapter } = await import('../../../../app/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter');
    const adapter = new FfmpegIngestVideoProcessingAdapter({
      thumbnailFinalizer: {
        finalizeThumbnail: vi.fn(async () => undefined),
      },
      videoTranscoder: {
        transcode,
      },
    });

    await expect(adapter.processPreparedVideo({
      encodingOptions: {
        encoder: 'gpu-h265',
      },
      sourcePath: '/videos/video-123/video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    })).resolves.toEqual({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
    });

    expect(transcode).toHaveBeenCalledWith({
      codecFamily: 'h265',
      quality: 'high',
      sourcePath: '/videos/video-123/video.mp4',
      useGpu: true,
      videoId: 'video-123',
    });
  });

  test('preserves partial-success semantics when transcoding fails without throwing', async () => {
    const transcode = vi.fn(async () => ({
      error: new TranscodingEngineError('transcode failed'),
      success: false as const,
    }));
    const { FfmpegIngestVideoProcessingAdapter } = await import('../../../../app/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter');
    const adapter = new FfmpegIngestVideoProcessingAdapter({
      thumbnailFinalizer: {
        finalizeThumbnail: vi.fn(async () => undefined),
      },
      videoTranscoder: {
        transcode,
      },
    });

    await expect(adapter.processPreparedVideo({
      sourcePath: '/videos/video-123/video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    })).resolves.toEqual({
      dashEnabled: false,
      message: 'Video added to library but video conversion failed',
    });
  });

  test('wraps thrown transcoder errors in an InternalError-compatible shape', async () => {
    const transcode = vi.fn(async () => {
      throw new Error('ffmpeg missing');
    });
    const { FfmpegIngestVideoProcessingAdapter } = await import('../../../../app/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter');
    const adapter = new FfmpegIngestVideoProcessingAdapter({
      thumbnailFinalizer: {
        finalizeThumbnail: vi.fn(async () => undefined),
      },
      videoTranscoder: {
        transcode,
      },
    });

    await expect(adapter.processPreparedVideo({
      sourcePath: '/videos/video-123/video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    })).rejects.toMatchObject({
      message: 'Video processing failed: ffmpeg missing',
      statusCode: 500,
    });
  });

  test('finalizeSuccessfulVideo delegates to the thumbnail finalizer and remains non-throwing', async () => {
    const finalizeThumbnail = vi.fn(async () => {
      throw new Error('thumbnail failed');
    });
    const { FfmpegIngestVideoProcessingAdapter } = await import('../../../../app/modules/ingest/infrastructure/processing/ffmpeg-ingest-video-processing.adapter');
    const adapter = new FfmpegIngestVideoProcessingAdapter({
      thumbnailFinalizer: {
        finalizeThumbnail,
      },
      videoTranscoder: {
        transcode: vi.fn(async () => ({
          data: {
            duration: 120,
            manifestPath: '/storage/data/videos/video-123/manifest.mpd',
            thumbnailPath: '/storage/data/videos/video-123/thumbnail.jpg',
            videoId: 'video-123',
          },
          success: true as const,
        })),
      },
    });

    await expect(adapter.finalizeSuccessfulVideo({
      title: 'Fixture Video',
      videoId: 'video-123',
    })).resolves.toBeUndefined();

    expect(finalizeThumbnail).toHaveBeenCalledWith({
      title: 'Fixture Video',
      videoId: 'video-123',
    });
  });
});
