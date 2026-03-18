import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('useAddVideosView', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('seeds new pending files with the browser-safe default encoding option', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      count: 1,
      files: [
        {
          createdAt: '2026-03-17T00:00:00.000Z',
          filename: 'fixture-video.mp4',
          id: 'pending-1',
          size: 1_024,
          thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
          type: 'mp4',
        },
      ],
      success: true,
    })));

    const { useAddVideosView } = await import('../../../app/legacy/widgets/add-videos-view/model/useAddVideosView');
    const { result } = renderHook(() => useAddVideosView());

    await waitFor(() => {
      expect(result.current.pendingFiles).toHaveLength(1);
    });

    expect(result.current.metadataByFilename['fixture-video.mp4']?.encodingOptions).toEqual({
      encoder: 'cpu-h264',
    });
  });

  test('preserves existing metadata for known files while seeding new scan results from the current response contract', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({
        count: 1,
        files: [
          {
            createdAt: '2026-03-17T00:00:00.000Z',
            filename: 'fixture-video.mp4',
            id: 'pending-1',
            size: 1_024,
            thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
            type: 'mp4',
          },
        ],
        success: true,
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        count: 2,
        files: [
          {
            createdAt: '2026-03-17T00:00:00.000Z',
            filename: 'fixture-video.mp4',
            id: 'pending-1',
            size: 1_024,
            thumbnailUrl: '/api/thumbnail-preview/fixture-video.jpg',
            type: 'mp4',
          },
          {
            createdAt: '2026-03-17T00:05:00.000Z',
            filename: 'second-video.mov',
            id: 'pending-2',
            size: 2_048,
            thumbnailUrl: '/api/thumbnail-preview/second-video.jpg',
            type: 'mov',
          },
        ],
        success: true,
      })));

    const { useAddVideosView } = await import('../../../app/legacy/widgets/add-videos-view/model/useAddVideosView');
    const { result } = renderHook(() => useAddVideosView());

    await waitFor(() => {
      expect(result.current.pendingFiles).toHaveLength(1);
    });

    act(() => {
      result.current.handleTitleChange('fixture-video.mp4', 'Custom title');
    });

    await act(async () => {
      await result.current.handleRefresh();
    });

    await waitFor(() => {
      expect(result.current.pendingFiles).toHaveLength(2);
    });

    expect(result.current.metadataByFilename['fixture-video.mp4']?.title).toBe('Custom title');
    expect(result.current.metadataByFilename['second-video.mov']).toEqual(expect.objectContaining({
      description: '',
      tags: '',
      title: 'second-video',
    }));
    expect(result.current.metadataByFilename['second-video.mov']?.encodingOptions).toEqual({
      encoder: 'cpu-h264',
    });
  });
});
