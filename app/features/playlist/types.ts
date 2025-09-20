import type { Playlist, PlaylistMetadata, PlaylistType } from '~/modules/playlist/domain/playlist.types';

// Re-export domain types for convenience
export type { Playlist, PlaylistMetadata, PlaylistType } from '~/modules/playlist/domain/playlist.types';

// UI-specific types for the playlist feature
export type ViewMode = 'grid' | 'compact' | 'list';

export interface PlaylistFilterState {
  searchQuery: string;
  filterType: PlaylistType | 'all';
  showPublicOnly: boolean;
}

export interface PlaylistUIActions {
  onQuickView?: (playlist: Playlist) => void;
  onPlay?: (playlist: Playlist) => void;
  onCreateNew?: () => void;
}

export interface PlaylistStats {
  total: number;
  byType: Record<PlaylistType, number>;
  public: number;
  private: number;
}

// Props interfaces for components
export interface PlaylistCardProps {
  playlist: Playlist;
  videoCount?: number;
  onPlay?: (playlist: Playlist) => void;
}

export interface PlaylistGridProps {
  playlists: Playlist[];
  videoCountMap?: Map<string, number>;
  isLoading?: boolean;
  onPlay?: (playlist: Playlist) => void;
  onCreateNew?: () => void;
}
