import { useNavigate } from 'react-router';
import type { Playlist } from '~/entities/playlist/model/playlist';
import { HomeShell } from '~/widgets/home-shell/ui/HomeShell';
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
  const navigate = useNavigate();

  return (
    <HomeShell
      searchQuery={searchQuery}
      onSearchChange={(query) => {
        onSearchChange(query);
        const params = new URLSearchParams();
        if (query) {
          params.set('q', query);
        }
        const nextSearch = params.toString();
        navigate(nextSearch ? `/playlists?${nextSearch}` : '/playlists');
      }}
    >
      <PlaylistsView
        playlists={playlists}
        videoCountMap={videoCountMap}
        total={total}
      />
    </HomeShell>
  );
}
