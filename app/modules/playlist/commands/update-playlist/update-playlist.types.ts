import type { PlaylistRepository, UserRepository } from '~/repositories/interfaces';
import type {
  Playlist,
  UpdatePlaylistRequest,
} from '../../domain/playlist.types';

/**
 * Update playlist use case request
 */
export interface UpdatePlaylistUseCaseRequest extends UpdatePlaylistRequest {
  playlistId: string;
  userId: string;
}

/**
 * Update playlist use case response
 */
export interface UpdatePlaylistUseCaseResponse {
  playlist: Playlist;
  message: string;
  fieldsUpdated: string[];
}

/**
 * Dependencies for the update playlist use case
 */
export interface UpdatePlaylistDependencies {
  playlistRepository: PlaylistRepository;
  userRepository: UserRepository;
  logger?: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, data?: any) => void;
  };
}

/**
 * Additional options for playlist updates
 */
export interface UpdatePlaylistOptions {
  validateOwnership?: boolean;
  generateThumbnailFromFirstVideo?: boolean;
  preserveVideoOrder?: boolean;
}
