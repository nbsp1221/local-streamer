import { Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useLoaderData } from 'react-router';
import type { Playlist } from '~/features/playlist/types';
import { AppLayout } from '~/components/AppLayout';
import { Button } from '~/components/ui/button';
import { CreatePlaylistDialog } from '~/features/playlist/components/CreatePlaylistDialog';
import { PlaylistGrid } from '~/features/playlist/components/PlaylistGrid';
import type { Route } from './+types/playlists';

// Loader function to fetch playlist data from server-side API
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const searchQuery = url.searchParams.get('q') || '';

  // Fetch from the real API endpoint
  const apiUrl = new URL('/api/playlists', url.origin);
  if (searchQuery) {
    apiUrl.searchParams.set('q', searchQuery);
  }

  const response = await fetch(apiUrl.toString(), {
    headers: {
      // Forward authentication cookie to maintain user session
      cookie: request.headers.get('cookie') || '',
    },
  });
  const data = await response.json();

  // Handle API response format
  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch playlists');
  }

  // Create video count map from playlists data
  const videoCountMap: Record<string, number> = {};
  data.playlists.forEach((playlist: { id: string; videoIds?: string[] }) => {
    videoCountMap[playlist.id] = playlist.videoIds?.length || 0;
  });

  return {
    playlists: data.playlists,
    videoCountMap,
    total: data.totalCount,
  };
}

export function meta() {
  return [
    { title: 'Playlists - Local Streamer' },
    { name: 'description', content: 'Manage your video playlists' },
  ];
}

export default function Playlists() {
  // Get data from server-side loader
  const { playlists, videoCountMap, total } = useLoaderData<typeof loader>();

  // Search is now handled by URL params and server-side filtering
  const [searchQuery, setSearchQuery] = useState('');

  // Dialog state for creating playlists
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Convert videoCountMap object back to Map for component compatibility
  const videoCountMapData = useMemo(() => {
    const map = new Map<string, number>();
    Object.entries(videoCountMap).forEach(([id, count]) => {
      map.set(id, count as number);
    });
    return map;
  }, [videoCountMap]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handlePlaylistPlay = useCallback((playlist: Playlist) => {
    console.log('Playing playlist:', playlist.name);
    // TODO: Navigate to player with first video
  }, []);

  const handleCreatePlaylist = useCallback(() => {
    setIsCreateDialogOpen(true);
  }, []);

  return (
    <AppLayout
      searchQuery={searchQuery}
      onSearchChange={handleSearchChange}
      pendingCount={0}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Simple header */}
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
          onCreateNew={handleCreatePlaylist}
        />

        {/* Create Playlist Dialog */}
        <CreatePlaylistDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
        />
      </div>
    </AppLayout>
  );
}
