import { useCallback, useMemo } from 'react';
import type { PlaylistStats, PlaylistWithVideos } from '~/modules/playlist/domain/playlist.types';
import { formatDuration } from '~/lib/utils';

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
}

interface UsePlaylistDetailViewProps {
  playlist: PlaylistWithVideos;
  stats: PlaylistStats | null;
  relatedPlaylists: RelatedPlaylistSummary[];
  videoPagination: VideoPaginationInfo | null;
  permissions: PlaylistPermissions;
}

interface PlaylistSummaryItem {
  label: string;
  value: string;
}

interface UsePlaylistDetailViewResult {
  summaryItems: PlaylistSummaryItem[];
  formattedDates: {
    createdAt: string;
    updatedAt: string;
  };
  totalDurationLabel: string;
  genreLabels: string[];
  relatedPlaylists: RelatedPlaylistSummary[];
  permissions: PlaylistPermissions;
  videoPagination: VideoPaginationInfo | null;
  handlePlayAll: () => void;
  handleVideoSelect: (videoId: string) => void;
  handleEditDetails: () => void;
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function usePlaylistDetailView({
  playlist,
  stats,
  relatedPlaylists,
  videoPagination,
  permissions,
}: UsePlaylistDetailViewProps): UsePlaylistDetailViewResult {
  const totalDurationSeconds = useMemo(() => {
    if (!Array.isArray(playlist.videos)) return 0;
    return playlist.videos.reduce((acc, video) => acc + (video.duration ?? 0), 0);
  }, [playlist.videos]);

  const summaryItems = useMemo<PlaylistSummaryItem[]>(() => {
    const items: PlaylistSummaryItem[] = [
      { label: 'Videos', value: playlist.videos.length.toString() },
      { label: 'Visibility', value: playlist.isPublic ? 'Public' : 'Private' },
      { label: 'Type', value: playlist.type.replace('_', ' ') },
    ];

    if (stats) {
      items.push({ label: 'Popularity', value: stats.popularityScore.toString() });
    }

    if (playlist.metadata?.seasonNumber !== undefined) {
      items.push({ label: 'Season', value: playlist.metadata.seasonNumber.toString() });
    }

    if (playlist.metadata?.episodeCount !== undefined) {
      items.push({ label: 'Episodes', value: playlist.metadata.episodeCount.toString() });
    }

    return items;
  }, [playlist.videos.length, playlist.isPublic, playlist.type, playlist.metadata, stats]);

  const genreLabels = useMemo(() => playlist.metadata?.genre ?? [], [playlist.metadata?.genre]);

  const formattedDates = useMemo(() => ({
    createdAt: formatDateLabel(playlist.createdAt),
    updatedAt: formatDateLabel(playlist.updatedAt),
  }), [playlist.createdAt, playlist.updatedAt]);

  const handlePlayAll = useCallback(() => {
    console.info('TODO: Implement playlist playback', {
      action: 'play-all',
      playlistId: playlist.id,
    });
  }, [playlist.id]);

  const handleVideoSelect = useCallback((videoId: string) => {
    console.info('TODO: Implement single video playback within playlist', {
      action: 'play-video',
      playlistId: playlist.id,
      videoId,
    });
  }, [playlist.id]);

  const handleAddVideos = useCallback(() => {
    console.info('TODO: Implement add videos to playlist', {
      action: 'add-videos',
      playlistId: playlist.id,
    });
  }, [playlist.id]);

  const handleEditDetails = useCallback(() => {
    console.info('TODO: Implement edit playlist details', {
      action: 'edit-details',
      playlistId: playlist.id,
    });
  }, [playlist.id]);

  return {
    summaryItems,
    formattedDates,
    totalDurationLabel: formatDuration(totalDurationSeconds),
    genreLabels,
    relatedPlaylists,
    permissions,
    videoPagination,
    handlePlayAll,
    handleVideoSelect,
    handleEditDetails,
  };
}
