import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Video } from '~/types/video';
import { useAuthUser } from '~/stores/auth-store';

interface PlaylistSummary {
  id: string;
  name: string;
  ownerId: string;
  isPublic: boolean;
  videoCount: number;
  containsVideo: boolean;
  updatedAt?: string;
}

type ActionState = 'idle' | 'loading' | 'success' | 'error';

interface RawPlaylist {
  id?: string;
  name?: string;
  ownerId?: string;
  isPublic?: boolean;
  videoIds?: unknown;
  updatedAt?: unknown;
}

interface UseAddToPlaylistDialogOptions {
  open: boolean;
  video: Video | null;
}

interface UseAddToPlaylistDialogResult {
  playlists: PlaylistSummary[];
  isLoading: boolean;
  error: string | null;
  actionStates: Record<string, ActionState>;
  handleAdd: (playlistId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function toSummary(rawPlaylist: RawPlaylist, videoId: string | null): PlaylistSummary {
  const rawVideoIds = rawPlaylist.videoIds;
  const videoIds = Array.isArray(rawVideoIds)
    ? (rawVideoIds as unknown[]).map(value => String(value))
    : [];

  return {
    id: String(rawPlaylist.id ?? ''),
    name: String(rawPlaylist.name ?? 'Untitled playlist'),
    ownerId: String(rawPlaylist.ownerId ?? ''),
    isPublic: Boolean(rawPlaylist.isPublic),
    videoCount: videoIds.length,
    containsVideo: Boolean(videoId && videoIds.includes(videoId)),
    updatedAt: typeof rawPlaylist.updatedAt === 'string' ? rawPlaylist.updatedAt : undefined,
  };
}

export function useAddToPlaylistDialog({ open, video }: UseAddToPlaylistDialogOptions): UseAddToPlaylistDialogResult {
  const user = useAuthUser();
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});

  const resetState = useCallback(() => {
    setPlaylists([]);
    setActionStates({});
    setError(null);
    setIsLoading(false);
  }, []);

  const loadPlaylists = useCallback(async () => {
    if (!open || !video) {
      return;
    }

    if (!user) {
      setError('You need to be logged in to manage playlists.');
      setPlaylists([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/playlists?limit=100&includeEmpty=true', {
        credentials: 'include',
      });
      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to load playlists');
      }

      const rawPlaylists = (Array.isArray(data.playlists) ? data.playlists : []) as RawPlaylist[];

      const ownedPlaylists = rawPlaylists
        .filter(raw => String(raw.ownerId ?? '') === user.id)
        .map(raw => toSummary(raw, video.id));

      setPlaylists(ownedPlaylists);
      setActionStates({});
      setError(null);
    }
    catch (loadError) {
      console.error('Failed to fetch playlists for dialog:', loadError);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load playlists');
    }
    finally {
      setIsLoading(false);
    }
  }, [open, user, video]);

  useEffect(() => {
    if (open) {
      void loadPlaylists();
    }
    else {
      resetState();
    }
  }, [open, loadPlaylists, resetState]);

  useEffect(() => {
    if (open && video) {
      void loadPlaylists();
    }
  }, [open, video?.id, loadPlaylists]);

  const handleAdd = useCallback(async (playlistId: string) => {
    if (!video) return;

    setActionStates(prev => ({ ...prev, [playlistId]: 'loading' }));

    try {
      const response = await fetch(`/api/playlists/${playlistId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ videoId: video.id }),
      });

      const data = await response.json();

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to add video to playlist');
      }

      setPlaylists(prev => prev.map((playlist) => {
        if (playlist.id !== playlistId) return playlist;
        return {
          ...playlist,
          containsVideo: true,
          videoCount: playlist.videoCount + 1,
        };
      }));
      setActionStates(prev => ({ ...prev, [playlistId]: 'success' }));
      setError(null);
    }
    catch (addError) {
      console.error('Failed to add video to playlist:', addError);
      setActionStates(prev => ({ ...prev, [playlistId]: 'error' }));
      setError(addError instanceof Error ? addError.message : 'Failed to add video to playlist');
    }
  }, [video]);

  const refresh = useCallback(async () => {
    await loadPlaylists();
  }, [loadPlaylists]);

  const normalizedPlaylists = useMemo(() => {
    if (!video) return [] as PlaylistSummary[];
    return playlists.map(playlist => ({
      ...playlist,
      containsVideo: playlist.containsVideo,
    }));
  }, [playlists, video]);

  return {
    playlists: normalizedPlaylists,
    isLoading,
    error,
    actionStates,
    handleAdd,
    refresh,
  };
}
