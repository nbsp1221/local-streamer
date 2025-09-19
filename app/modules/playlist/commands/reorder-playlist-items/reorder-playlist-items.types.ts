import type { PlaylistRepository, UserRepository } from '~/repositories/interfaces';

/**
 * Reorder playlist items use case request
 */
export interface ReorderPlaylistItemsUseCaseRequest {
  playlistId: string;
  userId: string;
  newOrder: string[]; // New order of video IDs
  preserveMetadata?: boolean; // Whether to preserve episode metadata positions
}

/**
 * Reorder playlist items use case response
 */
export interface ReorderPlaylistItemsUseCaseResponse {
  success: boolean;
  message: string;
  playlistName: string;
  videosReordered: number;
  oldOrder: string[];
  newOrder: string[];
}

/**
 * Dependencies for the reorder playlist items use case
 */
export interface ReorderPlaylistItemsDependencies {
  playlistRepository: PlaylistRepository;
  userRepository: UserRepository;
  logger?: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, data?: any) => void;
  };
}

/**
 * Additional options for reordering playlist items
 */
export interface ReorderPlaylistItemsOptions {
  validateVideoExistence?: boolean;
  updateEpisodeNumbers?: boolean; // Auto-update episode numbers for series
  preserveWatchProgress?: boolean;
  allowPartialReorder?: boolean; // Allow reordering subset of videos
}
