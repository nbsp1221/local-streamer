import { renderHook, waitFor } from '@testing-library/react';
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
          filename: 'fixture-video.mp4',
          id: 'pending-1',
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
});
