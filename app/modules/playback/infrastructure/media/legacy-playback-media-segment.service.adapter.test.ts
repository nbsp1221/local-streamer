import { describe, expect, test, vi } from 'vitest';

describe('PlaybackMediaSegmentService', () => {
  test('preserves range-response metadata and stream handles from the legacy segment use case', async () => {
    const { PlaybackMediaSegmentService } = await import('./playback-media-segment.service');
    const stream = new ReadableStream<Uint8Array>();
    const execute = vi.fn(async () => ({
      data: {
        headers: {
          'Content-Length': '128',
          'Content-Range': 'bytes 0-127/512',
        },
        isRangeResponse: true,
        statusCode: 206,
        stream,
        success: true as const,
      },
      success: true,
    }));
    const adapter = new PlaybackMediaSegmentService({
      execute,
    });

    const result = await adapter.serveSegment({
      filename: 'segment-0001.m4s',
      mediaType: 'video',
      rangeHeader: 'bytes=0-127',
      videoId: 'video-1',
    });

    expect(result).toEqual({
      headers: {
        'Content-Length': '128',
        'Content-Range': 'bytes 0-127/512',
      },
      isRangeResponse: true,
      statusCode: 206,
      stream,
    });
    expect(execute).toHaveBeenCalledOnce();
  });
});
