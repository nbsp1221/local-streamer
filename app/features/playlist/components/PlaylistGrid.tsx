import { Plus } from 'lucide-react';
import type { Playlist } from '~/modules/playlist/domain/playlist.types';
import { Button } from '~/components/ui/button';
import { PlaylistCard } from './PlaylistCard';

interface PlaylistGridProps {
  playlists: Playlist[];
  videoCountMap?: Map<string, number>;
  isLoading?: boolean;
  onPlay?: (playlist: Playlist) => void;
  onCreateNew?: () => void;
}

// Loading skeleton for playlist cards
const PlaylistCardSkeleton = () => (
  <div className="animate-pulse">
    <div className="aspect-video bg-gray-200 rounded-lg mb-3" />
    <div className="space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4" />
    </div>
  </div>
);

export function PlaylistGrid({
  playlists,
  videoCountMap,
  isLoading = false,
  onPlay,
  onCreateNew,
}: PlaylistGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {Array.from({ length: 10 }).map((_, index) => (
          <PlaylistCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (playlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Plus className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No playlists found</h3>
        <p className="text-gray-500 mb-6 max-w-md">
          Create your first playlist to organize your videos and start building your collection.
        </p>
        {onCreateNew && (
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Create Playlist
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {playlists.map(playlist => (
        <PlaylistCard
          key={playlist.id}
          playlist={playlist}
          videoCount={videoCountMap?.get(playlist.id)}
          onPlay={onPlay}
        />
      ))}
    </div>
  );
}

// Export compact and list view variants for future use
export const PlaylistCompactGrid = PlaylistGrid;
export const PlaylistListView = PlaylistGrid;
