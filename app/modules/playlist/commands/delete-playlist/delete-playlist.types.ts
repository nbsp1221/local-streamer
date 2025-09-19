import type { PlaylistRepository, UserRepository } from '~/repositories/interfaces';

/**
 * Delete playlist use case request
 */
export interface DeletePlaylistUseCaseRequest {
  playlistId: string;
  userId: string;
  force?: boolean; // Force delete even if playlist has videos
}

/**
 * Delete playlist use case response
 */
export interface DeletePlaylistUseCaseResponse {
  success: boolean;
  message: string;
  deletedPlaylistName: string;
  videosAffected: number;
  relatedPlaylistsAffected?: string[]; // For series/season relationships
}

/**
 * Dependencies for the delete playlist use case
 */
export interface DeletePlaylistDependencies {
  playlistRepository: PlaylistRepository;
  userRepository: UserRepository;
  logger?: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, data?: any) => void;
  };
}

/**
 * Additional options for playlist deletion
 */
export interface DeletePlaylistOptions {
  preserveVideos?: boolean;
  cascadeDeleteSeasons?: boolean; // For series playlists
  notifyRelatedPlaylists?: boolean;
}
