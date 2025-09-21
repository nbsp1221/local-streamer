import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Playlist } from '~/modules/playlist/domain/playlist.types';

interface UsePlaylistsViewProps {
  videoCountMap: Record<string, number>;
}

export function usePlaylistsView({ videoCountMap }: UsePlaylistsViewProps) {
  const navigate = useNavigate();

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Data transformation
  const videoCountMapData = useMemo(() => {
    const map = new Map<string, number>();
    Object.entries(videoCountMap).forEach(([id, count]) => {
      map.set(id, count as number);
    });
    return map;
  }, [videoCountMap]);

  // Event handlers
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handlePlaylistClick = useCallback((playlist: Playlist) => {
    navigate(`/playlists/${playlist.id}`);
  }, [navigate]);

  const handlePlaylistPlay = useCallback((playlist: Playlist) => {
    console.log('Playing playlist:', playlist.name);
    // TODO: Navigate to player with first video
  }, []);

  const handleCreatePlaylist = useCallback(() => {
    setIsCreateDialogOpen(true);
  }, []);

  const handleCreateDialogChange = useCallback((open: boolean) => {
    setIsCreateDialogOpen(open);
  }, []);

  // Return all state and handlers
  return {
    // State
    searchQuery,
    isCreateDialogOpen,
    videoCountMapData,

    // Handlers
    handleSearchChange,
    handlePlaylistClick,
    handlePlaylistPlay,
    handleCreatePlaylist,
    handleCreateDialogChange,
  };
}
