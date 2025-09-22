import type { PlaylistStats, PlaylistWithVideos } from '~/modules/playlist/domain/playlist.types';
import { AppLayout } from '~/components/AppLayout';
import { PlaylistDetailView } from '~/widgets/playlist-detail-view/ui/PlaylistDetailView';

interface PlaylistDetailPageProps {
  playlist: PlaylistWithVideos;
  stats: PlaylistStats | null;
  relatedPlaylists: Array<{
    id: string;
    name: string;
    type: string;
    videoCount: number;
    relationship: 'parent' | 'child' | 'sibling';
  }>;
  videoPagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  } | null;
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canAddVideos: boolean;
    canShare: boolean;
  };
}

export function PlaylistDetailPage({
  playlist,
  stats,
  relatedPlaylists,
  videoPagination,
  permissions,
}: PlaylistDetailPageProps) {
  return (
    <AppLayout>
      <PlaylistDetailView
        playlist={playlist}
        stats={stats}
        relatedPlaylists={relatedPlaylists}
        videoPagination={videoPagination}
        permissions={permissions}
      />
    </AppLayout>
  );
}
