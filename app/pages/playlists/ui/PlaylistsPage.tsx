import type { Playlist } from '~/modules/playlist/domain/playlist.types';
import { AppLayout } from '~/components/AppLayout';
import { PlaylistsView } from '~/widgets/playlists-view/ui/PlaylistsView';

interface PlaylistsPageProps {
  playlists: Playlist[];
  videoCountMap: Record<string, number>;
  total: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function PlaylistsPage({
  playlists,
  videoCountMap,
  total,
  searchQuery,
  onSearchChange,
}: PlaylistsPageProps) {
  return (
    <AppLayout
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      pendingCount={0}
    >
      <PlaylistsView
        playlists={playlists}
        videoCountMap={videoCountMap}
        total={total}
      />
    </AppLayout>
  );
}
