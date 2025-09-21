import { useCallback } from 'react';
import { useFetcher } from 'react-router';
import type { CreatePlaylistRequest } from '~/modules/playlist/domain/playlist.types';

interface UseCreatePlaylistReturn {
  createPlaylist: (data: CreatePlaylistRequest) => void;
  isSubmitting: boolean;
  isSuccess: boolean;
  error: string | null;
  reset: () => void;
}

export function useCreatePlaylist(): UseCreatePlaylistReturn {
  const fetcher = useFetcher();

  const createPlaylist = useCallback((data: CreatePlaylistRequest) => {
    fetcher.submit(
      JSON.stringify(data),
      {
        method: 'POST',
        action: '/api/playlists',
        encType: 'application/json',
      },
    );
  }, [fetcher]);

  const reset = useCallback(() => {
    // Reset fetcher state if needed
    if (fetcher.state === 'idle' && (fetcher.data?.success || fetcher.data?.error)) {
      // Force a new fetcher instance by calling load with current location
      fetcher.load(window.location.pathname);
    }
  }, [fetcher]);

  return {
    createPlaylist,
    isSubmitting: fetcher.state !== 'idle',
    isSuccess: fetcher.state === 'idle' && Boolean(fetcher.data?.success),
    error: fetcher.data?.error || null,
    reset,
  };
}
