import type { PlaylistRepository, UserRepository, VideoRepository } from '~/repositories/interfaces';
import type { PlaylistItem } from '../../domain/playlist.types';

/**
 * Add video to playlist use case request
 */
export interface AddVideoToPlaylistUseCaseRequest {
  playlistId: string;
  videoId: string;
  userId: string;
  position?: number; // Optional position, defaults to end
  episodeMetadata?: PlaylistItem['episodeMetadata'];
}

/**
 * Add video to playlist use case response
 */
export interface AddVideoToPlaylistUseCaseResponse {
  success: boolean;
  message: string;
  playlistName: string;
  videoTitle: string;
  finalPosition: number;
  totalVideosInPlaylist: number;
}

/**
 * Dependencies for the add video to playlist use case
 */
export interface AddVideoToPlaylistDependencies {
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
 * Additional options for adding video to playlist
 */
export interface AddVideoToPlaylistOptions {
  allowDuplicates?: boolean;
  autoDetectEpisodeNumber?: boolean;
  validateVideoAccess?: boolean;
  generateThumbnailFromVideo?: boolean;
}
