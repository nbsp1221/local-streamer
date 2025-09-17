import type { Result } from '~/lib/result';
import type {
  PlaylistError,
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
} from '../../domain/playlist.errors';
import type {
  AddVideoToPlaylistRequest,
  CreatePlaylistRequest,
  Playlist,
  PlaylistFilters,
  PlaylistItem,
  PlaylistStats,
  PlaylistType,
  PlaylistWithVideos,
  RemoveVideoFromPlaylistRequest,
  ReorderPlaylistRequest,
  UpdatePlaylistRequest,
} from '../../domain/playlist.types';

/**
 * Business-focused port for playlist repository operations.
 * This interface defines the contract for playlist data operations
 * from a business perspective, hiding implementation details.
 */
export interface PlaylistRepositoryPort {
  // ========== Core CRUD Operations ==========

  /**
   * Create a new playlist
   * @param request - Playlist creation request
   * @param userId - ID of the user creating the playlist
   * @returns Promise resolving to the created playlist or error
   */
  createPlaylist(
    request: CreatePlaylistRequest,
    userId: string,
  ): Promise<Result<Playlist, PlaylistError>>;

  /**
   * Find playlist by ID
   * @param playlistId - Unique identifier for the playlist
   * @param userId - ID of the requesting user (for permission checking)
   * @returns Promise resolving to the playlist or error
   */
  findPlaylistById(
    playlistId: string,
    userId?: string,
  ): Promise<Result<Playlist, PlaylistNotFoundError | PlaylistPermissionDeniedError>>;

  /**
   * Update playlist metadata
   * @param playlistId - Unique identifier for the playlist
   * @param updates - Updates to apply
   * @param userId - ID of the user making the update
   * @returns Promise resolving to the updated playlist or error
   */
  updatePlaylist(
    playlistId: string,
    updates: UpdatePlaylistRequest,
    userId: string,
  ): Promise<Result<Playlist, PlaylistError>>;

  /**
   * Delete playlist
   * @param playlistId - Unique identifier for the playlist
   * @param userId - ID of the user deleting the playlist
   * @returns Promise resolving to success boolean or error
   */
  deletePlaylist(
    playlistId: string,
    userId: string,
  ): Promise<Result<boolean, PlaylistError>>;

  // ========== Query Operations ==========

  /**
   * Find playlists for a specific user
   * @param userId - User ID to find playlists for
   * @param includePrivate - Whether to include private playlists
   * @returns Promise resolving to array of playlists
   */
  findUserPlaylists(
    userId: string,
    includePrivate?: boolean,
  ): Promise<Result<Playlist[], PlaylistError>>;

  /**
   * Search playlists with advanced filters
   * @param filters - Search and filter criteria
   * @param userId - ID of the requesting user (affects private playlist visibility)
   * @returns Promise resolving to filtered playlists
   */
  searchPlaylists(
    filters: PlaylistFilters,
    userId?: string,
  ): Promise<Result<Playlist[], PlaylistError>>;

  /**
   * Find playlists by type
   * @param type - Playlist type to filter by
   * @param userId - ID of the requesting user
   * @returns Promise resolving to playlists of specified type
   */
  findPlaylistsByType(
    type: PlaylistType,
    userId?: string,
  ): Promise<Result<Playlist[], PlaylistError>>;

  /**
   * Find all playlists belonging to a series
   * @param seriesName - Name of the series
   * @param userId - ID of the requesting user
   * @returns Promise resolving to series playlists
   */
  findSeriesPlaylists(
    seriesName: string,
    userId?: string,
  ): Promise<Result<Playlist[], PlaylistError>>;

  // ========== Video Management Operations ==========

  /**
   * Add video to playlist
   * @param request - Add video request
   * @param userId - ID of the user adding the video
   * @returns Promise resolving to success boolean or error
   */
  addVideoToPlaylist(
    request: AddVideoToPlaylistRequest,
    userId: string,
  ): Promise<Result<boolean, PlaylistError>>;

  /**
   * Remove video from playlist
   * @param request - Remove video request
   * @param userId - ID of the user removing the video
   * @returns Promise resolving to success boolean or error
   */
  removeVideoFromPlaylist(
    request: RemoveVideoFromPlaylistRequest,
    userId: string,
  ): Promise<Result<boolean, PlaylistError>>;

  /**
   * Reorder videos in playlist
   * @param request - Reorder request with new video order
   * @param userId - ID of the user reordering
   * @returns Promise resolving to success boolean or error
   */
  reorderPlaylistVideos(
    request: ReorderPlaylistRequest,
    userId: string,
  ): Promise<Result<boolean, PlaylistError>>;

  // ========== Rich Data Operations ==========

  /**
   * Get playlist with populated video details
   * @param playlistId - Unique identifier for the playlist
   * @param userId - ID of the requesting user
   * @returns Promise resolving to playlist with video details or error
   */
  getPlaylistWithVideos(
    playlistId: string,
    userId?: string,
  ): Promise<Result<PlaylistWithVideos, PlaylistError>>;

  /**
   * Find playlists containing a specific video
   * @param videoId - Video ID to search for
   * @param userId - ID of the requesting user
   * @returns Promise resolving to playlists containing the video
   */
  findPlaylistsContainingVideo(
    videoId: string,
    userId?: string,
  ): Promise<Result<Playlist[], PlaylistError>>;

  // ========== Analytics and Stats ==========

  /**
   * Get playlist statistics
   * @param playlistId - Unique identifier for the playlist
   * @returns Promise resolving to playlist statistics
   */
  getPlaylistStats(playlistId: string): Promise<Result<PlaylistStats, PlaylistError>>;

  /**
   * Get popular playlists
   * @param limit - Maximum number of playlists to return
   * @param userId - ID of the requesting user (affects visibility)
   * @returns Promise resolving to popular playlists
   */
  getPopularPlaylists(
    limit: number,
    userId?: string,
  ): Promise<Result<Playlist[], PlaylistError>>;

  /**
   * Get recently created playlists
   * @param limit - Maximum number of playlists to return
   * @param userId - ID of the requesting user (affects visibility)
   * @returns Promise resolving to recently created playlists
   */
  getRecentPlaylists(
    limit: number,
    userId?: string,
  ): Promise<Result<Playlist[], PlaylistError>>;

  // ========== Utility Operations ==========

  /**
   * Check if user owns playlist
   * @param playlistId - Unique identifier for the playlist
   * @param userId - User ID to check ownership for
   * @returns Promise resolving to ownership status
   */
  isPlaylistOwner(playlistId: string, userId: string): Promise<boolean>;

  /**
   * Check if playlist name exists for user
   * @param name - Playlist name to check
   * @param userId - User ID to check for
   * @param excludePlaylistId - Playlist ID to exclude from check (for updates)
   * @returns Promise resolving to existence status
   */
  playlistNameExists(
    name: string,
    userId: string,
    excludePlaylistId?: string,
  ): Promise<boolean>;

  /**
   * Get all unique genres from playlists
   * @param userId - ID of the requesting user (affects visibility)
   * @returns Promise resolving to unique genres
   */
  getAllGenres(userId?: string): Promise<Result<string[], PlaylistError>>;

  // ========== Batch Operations ==========

  /**
   * Delete multiple playlists
   * @param playlistIds - Array of playlist IDs to delete
   * @param userId - ID of the user performing the deletion
   * @returns Promise resolving to batch operation results
   */
  batchDeletePlaylists(
    playlistIds: string[],
    userId: string,
  ): Promise<Result<{ successful: string[]; failed: string[] }, PlaylistError>>;

  /**
   * Update access level for multiple playlists
   * @param playlistIds - Array of playlist IDs to update
   * @param isPublic - New access level
   * @param userId - ID of the user performing the update
   * @returns Promise resolving to batch operation results
   */
  batchUpdateAccess(
    playlistIds: string[],
    isPublic: boolean,
    userId: string,
  ): Promise<Result<{ successful: string[]; failed: string[] }, PlaylistError>>;
}

/**
 * Business-focused result types for common operations
 */
export interface PlaylistCreationResult {
  playlist: Playlist;
  autoGeneratedThumbnail: boolean;
  suggestedMetadata?: Partial<Playlist['metadata']>;
}

export interface PlaylistDeletionResult {
  success: boolean;
  videosAffected: number;
  relatedPlaylistsAffected: string[];
}

export interface PlaylistVideoOperationResult {
  success: boolean;
  newPosition?: number;
  playlistUpdated: boolean;
  conflictResolution?: string;
}
