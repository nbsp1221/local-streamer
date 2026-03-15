import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useHomeLibraryVideoActions } from '../../../app/features/home-library-video-actions/model/useHomeLibraryVideoActions';

describe('useHomeLibraryVideoActions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('deleteVideo sends DELETE to the expected endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useHomeLibraryVideoActions());

    await expect(result.current.deleteVideo('video-1')).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith('/api/delete/video-1', {
      method: 'DELETE',
    });
  });

  test('updateVideo sends PUT with a JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        video: {
          createdAt: '2026-03-11T00:00:00.000Z',
          description: 'Trimmed description',
          duration: 180,
          id: 'video-1',
          tags: ['Action', 'Neo'],
          thumbnailUrl: '/thumb.jpg',
          title: 'Updated title',
          videoUrl: '/videos/video-1/manifest.mpd',
        },
      }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useHomeLibraryVideoActions());

    await expect(result.current.updateVideo('video-1', {
      description: 'Updated description',
      tags: ['Action', 'Neo'],
      title: 'Updated title',
    })).resolves.toEqual({
      createdAt: new Date('2026-03-11T00:00:00.000Z'),
      description: 'Trimmed description',
      duration: 180,
      id: 'video-1',
      tags: ['Action', 'Neo'],
      thumbnailUrl: '/thumb.jpg',
      title: 'Updated title',
      videoUrl: '/videos/video-1/manifest.mpd',
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/update/video-1', {
      body: JSON.stringify({
        description: 'Updated description',
        tags: ['Action', 'Neo'],
        title: 'Updated title',
      }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'PUT',
    });
  });

  test('rejects with the server error when delete fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ error: 'Failed to delete video', success: false }),
      ok: false,
    }));
    const { result } = renderHook(() => useHomeLibraryVideoActions());

    await expect(result.current.deleteVideo('video-1')).rejects.toThrow('Failed to delete video');
  });

  test('propagates network failures without swallowing them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { result } = renderHook(() => useHomeLibraryVideoActions());

    await expect(result.current.updateVideo('video-1', {
      tags: ['Action'],
      title: 'Updated title',
    })).rejects.toThrow('network down');
  });
});
