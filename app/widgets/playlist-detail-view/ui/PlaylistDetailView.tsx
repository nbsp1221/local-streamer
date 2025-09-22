import type { PlaylistStats, PlaylistWithVideos } from '~/modules/playlist/domain/playlist.types';
import { usePlaylistDetailView } from '../model/usePlaylistDetailView';
import { PlaylistDetailLayout } from './PlaylistDetailLayout';
import { PlaylistInfoPanel } from './PlaylistInfoPanel';
import { PlaylistVideoList } from './PlaylistVideoList';

interface RelatedPlaylistSummary {
  id: string;
  name: string;
  type: string;
  videoCount: number;
  relationship: 'parent' | 'child' | 'sibling';
}

interface VideoPaginationInfo {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface PlaylistPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canAddVideos?: boolean;
}

interface PlaylistDetailViewProps {
  playlist: PlaylistWithVideos;
  stats: PlaylistStats | null;
  relatedPlaylists: RelatedPlaylistSummary[];
  videoPagination: VideoPaginationInfo | null;
  permissions: PlaylistPermissions;
}

export function PlaylistDetailView({
  playlist,
  stats,
  relatedPlaylists,
  videoPagination,
  permissions,
}: PlaylistDetailViewProps) {
  const view = usePlaylistDetailView({
    playlist,
    stats,
    relatedPlaylists,
    videoPagination,
    permissions,
  });

  return (
    <PlaylistDetailLayout
      infoSlot={(
        <PlaylistInfoPanel
          playlist={playlist}
          summaryItems={view.summaryItems}
          formattedDates={view.formattedDates}
          totalDurationLabel={view.totalDurationLabel}
          genreLabels={view.genreLabels}
          relatedPlaylists={view.relatedPlaylists}
          permissions={view.permissions}
          onPlayAll={view.handlePlayAll}
          onEditDetails={view.handleEditDetails}
        />
      )}
      videosSlot={(
        <PlaylistVideoList
          playlist={playlist}
          onVideoSelect={view.handleVideoSelect}
          videoPagination={view.videoPagination}
        />
      )}
    />
  );
}
