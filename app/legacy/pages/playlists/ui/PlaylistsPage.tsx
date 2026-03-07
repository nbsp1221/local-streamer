import type { Playlist } from '~/legacy/modules/playlist/domain/playlist.types';
import { AppLayout } from '~/legacy/components/AppLayout';
import { PlaylistsView } from '~/legacy/widgets/playlists-view/ui/PlaylistsView';

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
