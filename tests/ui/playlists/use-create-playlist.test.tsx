import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const fetcherLoadMock = vi.fn();
const fetcherSubmitMock = vi.fn();
const revalidateMock = vi.fn();
let fetcherData: { success?: boolean } | undefined;
let fetcherState = 'idle';

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');

  return {
    ...actual,
    useFetcher: () => ({
      data: fetcherData,
      load: fetcherLoadMock,
      state: fetcherState,
      submit: fetcherSubmitMock,
    }),
    useRevalidator: () => ({
      revalidate: revalidateMock,
      state: 'idle',
    }),
  };
});

describe('useCreatePlaylist', () => {
  beforeEach(() => {
    fetcherData = undefined;
    fetcherLoadMock.mockReset();
    fetcherSubmitMock.mockReset();
    fetcherState = 'idle';
    revalidateMock.mockReset();
  });

  test('submits a plain object payload to the playlist action', async () => {
    const { useCreatePlaylist } = await import('../../../app/features/playlist-create/model/useCreatePlaylist');
    const { result } = renderHook(() => useCreatePlaylist());

    act(() => {
      result.current.createPlaylist({
        description: 'Fixture playlist',
        isPublic: false,
        name: 'Vault',
        type: 'user_created',
      });
    });

    expect(fetcherSubmitMock).toHaveBeenCalledWith({
      description: 'Fixture playlist',
      isPublic: false,
      name: 'Vault',
      type: 'user_created',
    }, {
      action: '/api/playlists',
      encType: 'application/json',
      method: 'POST',
    });
  });

  test('revalidates the current route when creation succeeds', async () => {
    const { useCreatePlaylist } = await import('../../../app/features/playlist-create/model/useCreatePlaylist');
    const { result, rerender } = renderHook(() => useCreatePlaylist());

    fetcherData = { success: true };
    fetcherState = 'idle';
    rerender();

    expect(revalidateMock).toHaveBeenCalled();
    expect(fetcherLoadMock).not.toHaveBeenCalled();
    expect(result.current.isSuccess).toBe(true);
  });

  test('keeps the success state until reset after a successful creation', async () => {
    const { useCreatePlaylist } = await import('../../../app/features/playlist-create/model/useCreatePlaylist');
    const { result, rerender } = renderHook(() => useCreatePlaylist());

    fetcherData = { success: true };
    fetcherState = 'idle';
    rerender();

    fetcherData = undefined;
    rerender();

    expect(result.current.isSuccess).toBe(true);

    act(() => {
      result.current.reset();
    });

    rerender();
    expect(result.current.isSuccess).toBe(false);
  });
});
