import { beforeEach, describe, expect, test, vi } from 'vitest';

const migrateExistingThumbnailMock = vi.fn();
const transcodeMock = vi.fn();

vi.mock('~/legacy/modules/video/transcoding', () => ({
  FFmpegVideoTranscoderAdapter: vi.fn(() => ({
    transcode: transcodeMock,
  })),
}));

vi.mock('~/legacy/modules/thumbnail/shared/thumbnail-generator-encrypted.server', () => ({
  encryptedThumbnailGenerator: {
    migrateExistingThumbnail: migrateExistingThumbnailMock,
  },
}));

describe('ingest legacy video processing', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('processes the prepared video and preserves partial-success semantics when transcoding fails', async () => {
    transcodeMock.mockResolvedValue({
      error: new Error('transcode failed'),
      success: false,
    });

    const { createIngestLegacyVideoProcessing } = await import('../../../app/composition/server/ingest-legacy-video-processing');
    const processing = createIngestLegacyVideoProcessing();
    const result = await processing.processPreparedVideo({
      encodingOptions: {
        encoder: 'gpu-h265',
      },
      sourcePath: '/videos/video-123/video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    });

    expect(transcodeMock).toHaveBeenCalledWith({
      codecFamily: 'h265',
      quality: 'high',
      sourcePath: '/videos/video-123/video.mp4',
      useGpu: true,
      videoId: 'video-123',
    });
    expect(result).toEqual({
      dashEnabled: false,
      message: 'Video added to library but video conversion failed',
    });
  });

  test('wraps thrown transcoder errors in an InternalError', async () => {
    transcodeMock.mockRejectedValue(new Error('ffmpeg missing'));

    const { createIngestLegacyVideoProcessing } = await import('../../../app/composition/server/ingest-legacy-video-processing');
    const processing = createIngestLegacyVideoProcessing();

    await expect(processing.processPreparedVideo({
      sourcePath: '/videos/video-123/video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    })).rejects.toMatchObject({
      message: 'Video processing failed: ffmpeg missing',
      statusCode: 500,
    });
  });

  test('finalizes a successful prepared video by encrypting the thumbnail after metadata persistence', async () => {
    migrateExistingThumbnailMock.mockResolvedValue({
      success: true,
    });

    const { createIngestLegacyVideoProcessing } = await import('../../../app/composition/server/ingest-legacy-video-processing');
    const processing = createIngestLegacyVideoProcessing();
    await processing.finalizeSuccessfulVideo({
      title: 'Fixture Video',
      videoId: 'video-123',
    });

    expect(migrateExistingThumbnailMock).toHaveBeenCalledWith('video-123');
  });
});
