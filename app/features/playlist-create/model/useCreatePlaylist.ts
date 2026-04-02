import { useCallback, useEffect, useState } from 'react';
import { useFetcher, useRevalidator } from 'react-router';
import type { CreatePlaylistRequest } from '~/entities/playlist/model/playlist';

interface UseCreatePlaylistReturn {
  createPlaylist: (data: CreatePlaylistRequest) => void;
  isSubmitting: boolean;
  isSuccess: boolean;
  error: string | null;
  reset: () => void;
}

export function useCreatePlaylist(): UseCreatePlaylistReturn {
  const fetcher = useFetcher();
  const revalidator = useRevalidator();
  const [didSucceed, setDidSucceed] = useState(false);
  const fetcherSucceeded = fetcher.state === 'idle' && Boolean(fetcher.data?.success);

  const createPlaylist = useCallback((data: CreatePlaylistRequest) => {
    const payload: Record<string, unknown> = {
      name: data.name,
      type: data.type,
    };

    if (data.description !== undefined) {
      payload.description = data.description;
    }

    if (data.initialVideoIds !== undefined) {
      payload.initialVideoIds = [...data.initialVideoIds];
    }

    if (data.isPublic !== undefined) {
      payload.isPublic = data.isPublic;
    }

    if (data.metadata !== undefined) {
      payload.metadata = JSON.parse(JSON.stringify(data.metadata)) as Record<string, unknown>;
    }

    fetcher.submit(
      payload as Parameters<typeof fetcher.submit>[0],
      {
        method: 'POST',
        action: '/api/playlists',
        encType: 'application/json',
      },
    );
  }, [fetcher]);

  useEffect(() => {
    if (fetcherSucceeded) {
      setDidSucceed(true);
      revalidator.revalidate();
    }
  }, [fetcherSucceeded, revalidator]);

  const reset = useCallback(() => {
    setDidSucceed(false);

    if (fetcher.state === 'idle' && (fetcher.data?.success || fetcher.data?.error || didSucceed)) {
      revalidator.revalidate();
    }
  }, [didSucceed, fetcher.data, fetcher.state, revalidator]);

  return {
    createPlaylist,
    isSubmitting: fetcher.state !== 'idle',
    isSuccess: didSucceed || fetcherSucceeded,
    error: fetcher.data?.error || null,
    reset,
  };
}
