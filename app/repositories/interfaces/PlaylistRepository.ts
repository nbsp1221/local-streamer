import type {
  Playlist,
  PlaylistFilters,
  PlaylistItem,
  PlaylistStats,
  PlaylistType,
} from '~/modules/playlist/domain/playlist.types';
import type { BaseRepository } from './BaseRepository';

/**
 * Input for creating a new playlist
 */
export interface CreatePlaylistInput {
  id?: string; // Optional ID - if not provided, UUID will be generated
  name: string;
  description?: string;
  type: PlaylistType;
  videoIds?: string[];
  thumbnailUrl?: string;
  ownerId: string;
  isPublic?: boolean;
  metadata?: Playlist['metadata'];
}

/**
 * Input for updating an existing playlist
 */
export interface UpdatePlaylistInput {
  name?: string;
  description?: string;
  isPublic?: boolean;
  thumbnailUrl?: string;
  metadata?: Playlist['metadata'];
}

/**
 * Playlist repository interface extending base repository with playlist-specific methods
 */
export interface PlaylistRepository extends BaseRepository<Playlist, CreatePlaylistInput, UpdatePlaylistInput> {
  /**
   * Find playlists by owner ID
   */
  findByOwner(ownerId: string): Promise<Playlist[]>;

  /**
   * Find playlists by type
   */
  findByType(type: PlaylistType): Promise<Playlist[]>;

  /**
   * Find public playlists only
   */
  findPublicPlaylists(): Promise<Playlist[]>;

  /**
   * Find playlists by series name (for series/season types)
   */
  findBySeries(seriesName: string): Promise<Playlist[]>;

  /**
   * Search playlists with filters
   */
  findWithFilters(filters: PlaylistFilters): Promise<Playlist[]>;

  /**
   * Search playlists by name (case-insensitive partial match)
   */
  findByName(name: string): Promise<Playlist[]>;

  /**
   * Get all unique genres across all playlists
   */
  getAllGenres(): Promise<string[]>;

  /**
   * Search playlists by query (name, description, genre)
   */
  search(query: string): Promise<Playlist[]>;

  /**
   * Check if playlist name exists for a user
   */
  nameExistsForUser(name: string, ownerId: string, excludeId?: string): Promise<boolean>;

  /**
   * Get most popular playlists (by view count or other metrics)
   */
  getMostPopular(limit: number): Promise<Playlist[]>;

  /**
   * Get recently created playlists
   */
  getRecentlyCreated(limit: number): Promise<Playlist[]>;

  /**
   * Add video to playlist at specific position
   */
  addVideoToPlaylist(playlistId: string, videoId: string, position?: number): Promise<void>;

  /**
   * Remove video from playlist
   */
  removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void>;

  /**
   * Reorder videos in playlist
   */
  reorderPlaylistItems(playlistId: string, newOrder: string[]): Promise<void>;

  /**
   * Get playlist with video details
   */
  getPlaylistWithVideos(playlistId: string): Promise<Playlist & { videos: any[] } | null>;

  /**
   * Get playlists containing a specific video
   */
  findContainingVideo(videoId: string): Promise<Playlist[]>;

  /**
   * Batch operations for playlists
   */
  batchDelete(playlistIds: string[]): Promise<{ successful: string[]; failed: string[] }>;

  /**
   * Update playlist access (make public/private)
   */
  updateAccess(playlistId: string, isPublic: boolean): Promise<boolean>;
}

/**
 * Playlist item repository for managing video-playlist relationships
 */
export interface PlaylistItemRepository extends BaseRepository<PlaylistItem, Omit<PlaylistItem, 'addedAt'>, Partial<Omit<PlaylistItem, 'videoId' | 'addedAt'>>> {
  /**
   * Find all items for a playlist
   */
  findByPlaylistId(playlistId: string): Promise<PlaylistItem[]>;

  /**
   * Find specific item in playlist
   */
  findByPlaylistAndVideo(playlistId: string, videoId: string): Promise<PlaylistItem | null>;

  /**
   * Get next position for new item in playlist
   */
  getNextPosition(playlistId: string): Promise<number>;

  /**
   * Update positions after reordering
   */
  updatePositions(items: Array<{ videoId: string; position: number }>): Promise<void>;

  /**
   * Remove all items from playlist
   */
  clearPlaylist(playlistId: string): Promise<void>;

  /**
   * Get items in position order
   */
  findByPlaylistIdOrdered(playlistId: string): Promise<PlaylistItem[]>;
}
