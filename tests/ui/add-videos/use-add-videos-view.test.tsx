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

    const { useAddVideosView } = await import('../../../app/widgets/add-videos/model/useAddVideosView');
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

    const { useAddVideosView } = await import('../../../app/widgets/add-videos/model/useAddVideosView');
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

  test('posts the preserved add-to-library request body and removes the processed file on success', async () => {
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
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        success: true,
        videoId: 'video-123',
      })));

    const { useAddVideosView } = await import('../../../app/widgets/add-videos/model/useAddVideosView');
    const { result } = renderHook(() => useAddVideosView());

    await waitFor(() => {
      expect(result.current.pendingFiles).toHaveLength(1);
    });

    act(() => {
      result.current.handleTitleChange('fixture-video.mp4', 'Custom title');
      result.current.handleTagsChange('fixture-video.mp4', 'one, two');
      result.current.handleDescriptionChange('fixture-video.mp4', 'Custom description');
      result.current.handleEncodingOptionsChange('fixture-video.mp4', {
        encoder: 'gpu-h264',
      });
    });

    await act(async () => {
      await result.current.handleAddToLibrary('fixture-video.mp4');
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/add-to-library', expect.objectContaining({
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }));
    const addToLibraryRequest = fetchMock.mock.calls[1]?.[1];
    expect(addToLibraryRequest).toBeDefined();
    expect(JSON.parse(String(addToLibraryRequest?.body))).toEqual({
      description: 'Custom description',
      encodingOptions: {
        encoder: 'gpu-h264',
      },
      filename: 'fixture-video.mp4',
      tags: ['one', 'two'],
      title: 'Custom title',
    });
    expect(result.current.successMessage).toBe('"Custom title" has been added to the library.');
    expect(result.current.error).toBeNull();
    expect(result.current.pendingFiles).toEqual([]);
    expect(result.current.metadataByFilename['fixture-video.mp4']).toBeUndefined();
  });

  test('preserves the existing add-to-library failure handling when the API rejects the request', async () => {
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
        error: 'Failed to add to library.',
        success: false,
      })));

    const { useAddVideosView } = await import('../../../app/widgets/add-videos/model/useAddVideosView');
    const { result } = renderHook(() => useAddVideosView());

    await waitFor(() => {
      expect(result.current.pendingFiles).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleAddToLibrary('fixture-video.mp4');
    });

    expect(result.current.error).toBe('Failed to add to library.');
    expect(result.current.successMessage).toBeNull();
    expect(result.current.pendingFiles).toHaveLength(1);
    expect(result.current.metadataByFilename['fixture-video.mp4']).toEqual(expect.objectContaining({
      title: 'fixture-video',
    }));
  });

  test('keeps the file pending when processing fails after preparation and the API returns the retryable failure contract', async () => {
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
        error: 'Video conversion failed. The upload was restored so you can retry.',
        success: false,
      }), { status: 500 }));

    const { useAddVideosView } = await import('../../../app/widgets/add-videos/model/useAddVideosView');
    const { result } = renderHook(() => useAddVideosView());

    await waitFor(() => {
      expect(result.current.pendingFiles).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleAddToLibrary('fixture-video.mp4');
    });

    expect(result.current.error).toBe('Video conversion failed. The upload was restored so you can retry.');
    expect(result.current.successMessage).toBeNull();
    expect(result.current.pendingFiles).toHaveLength(1);
    expect(result.current.processingFiles.size).toBe(0);
  });
});
