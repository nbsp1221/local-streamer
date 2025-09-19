import type { PlaylistRepository, UserRepository } from '~/repositories/interfaces';
import type { Playlist, PlaylistFilters, PlaylistStats } from '../../domain/playlist.types';

/**
 * Find playlists query use case request
 */
export interface FindPlaylistsUseCaseRequest {
  userId?: string; // Optional for public playlists search
  filters?: PlaylistFilters;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'videoCount' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  includeStats?: boolean;
  includeEmpty?: boolean; // Include playlists with no videos
}

/**
 * Find playlists query use case response
 */
export interface FindPlaylistsUseCaseResponse {
  playlists: Playlist[];
  stats?: PlaylistStats[];
  totalCount: number;
  hasMore: boolean;
  filters: PlaylistFilters;
  pagination: {
    limit: number;
    offset: number;
    totalPages: number;
    currentPage: number;
  };
}

/**
 * Dependencies for the find playlists query use case
 */
export interface FindPlaylistsDependencies {
  playlistRepository: PlaylistRepository;
  userRepository: UserRepository;
  logger?: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, data?: any) => void;
  };
}

/**
 * Additional options for finding playlists
 */
export interface FindPlaylistsOptions {
  includePrivate?: boolean;
  includeVideoDetails?: boolean;
  cacheResults?: boolean;
  maxResults?: number;
}
