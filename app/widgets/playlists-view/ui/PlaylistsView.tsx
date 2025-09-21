import { Plus } from 'lucide-react';
import type { Playlist } from '~/modules/playlist/domain/playlist.types';
import { Button } from '~/components/ui/button';
import { CreatePlaylistDialog } from '~/features/playlist/create-playlist/ui/CreatePlaylistDialog';
import { usePlaylistsView } from '../model/usePlaylistsView';
import { PlaylistGrid } from './PlaylistGrid';

interface PlaylistsViewProps {
  playlists: Playlist[];
  videoCountMap: Record<string, number>;
  total: number;
}

export function PlaylistsView({
  playlists,
  videoCountMap,
  total,
}: PlaylistsViewProps) {
  const {
    isCreateDialogOpen,
    videoCountMapData,
    handlePlaylistPlay,
    handlePlaylistClick,
    handleCreatePlaylist,
    handleCreateDialogChange,
  } = usePlaylistsView({ videoCountMap });

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header section */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">My Playlists</h1>
          <p className="text-muted-foreground">
            {total === 0 ? (
              'No playlists yet'
            ) : (
              `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`
            )}
          </p>
        </div>

        <Button onClick={handleCreatePlaylist} className="gap-2">
          <Plus className="h-4 w-4" />
          New Playlist
        </Button>
      </div>

      {/* Playlist grid */}
      <PlaylistGrid
        playlists={playlists}
        videoCountMap={videoCountMapData}
        isLoading={false}
        onPlay={handlePlaylistPlay}
        onClick={handlePlaylistClick}
        onCreateNew={handleCreatePlaylist}
      />

      {/* Create Playlist Dialog */}
      <CreatePlaylistDialog
        open={isCreateDialogOpen}
        onOpenChange={handleCreateDialogChange}
      />
    </div>
  );
}
