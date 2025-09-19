import type { PlaylistRepository, UserRepository, VideoRepository } from '~/repositories/interfaces';
import type { PlaylistStats, PlaylistWithVideos } from '../../domain/playlist.types';

/**
 * Get playlist details query use case request
 */
export interface GetPlaylistDetailsUseCaseRequest {
  playlistId: string;
  userId?: string; // Optional for public playlists
  includeVideos?: boolean; // Include full video details
  includeStats?: boolean; // Include playlist statistics
  includeRelated?: boolean; // Include related playlists (for series/seasons)
  videoLimit?: number; // Limit number of videos returned
  videoOffset?: number; // Offset for video pagination
}

/**
 * Get playlist details query use case response
 */
export interface GetPlaylistDetailsUseCaseResponse {
  playlist: PlaylistWithVideos;
  stats?: PlaylistStats;
  relatedPlaylists?: Array<{
    id: string;
    name: string;
    type: string;
    videoCount: number;
    relationship: 'parent' | 'child' | 'sibling';
  }>;
  videoPagination?: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  permissions: {
    canEdit: boolean;
    canDelete: boolean;
    canAddVideos: boolean;
    canShare: boolean;
  };
}

/**
 * Dependencies for the get playlist details query use case
 */
export interface GetPlaylistDetailsDependencies {
  playlistRepository: PlaylistRepository;
  userRepository: UserRepository;
  videoRepository: VideoRepository;
  logger?: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, data?: any) => void;
  };
}

/**
 * Additional options for getting playlist details
 */
export interface GetPlaylistDetailsOptions {
  includeVideoMetadata?: boolean;
  includeWatchProgress?: boolean;
  validateVideoAccess?: boolean;
  populateThumbnails?: boolean;
}
