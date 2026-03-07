/**
 * Core Playlist Domain Types
 *
 * This module defines the core domain types for the playlist system,
 * supporting both user-created playlists and series/season management.
 */

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  type: PlaylistType;
  videoIds: string[]; // Ordered array of video IDs
  thumbnailUrl?: string; // Auto-generated from first video or custom
  ownerId: string; // User who created the playlist
  isPublic: boolean; // Public/private visibility
  createdAt: Date;
  updatedAt: Date;

  // Extended metadata for series/seasons
  metadata?: PlaylistMetadata;
}

/**
 * Playlist types supporting different use cases
 */
export type PlaylistType =
  | 'user_created' // User-made playlist
  | 'series' // TV series/anime (parent)
  | 'season' // Season within a series (child)
  | 'auto_generated'; // Auto-created (e.g., from tags)

/**
 * Extended metadata for series and season playlists
 */
export interface PlaylistMetadata {
  seriesName?: string; // "Attack on Titan"
  seasonNumber?: number; // 1, 2, 3...
  episodeCount?: number; // Total episodes in playlist
  genre?: string[]; // ["anime", "action"]
  year?: number; // Production year
  status?: 'ongoing' | 'completed' | 'hiatus';
  parentPlaylistId?: string; // For seasons pointing to main series

  // Additional series metadata
  originalLanguage?: string; // "Japanese", "English"
  studio?: string; // "Mappa", "WIT Studio"
  rating?: string; // "TV-14", "R"
}

/**
 * Individual item within a playlist with positioning and metadata
 */
export interface PlaylistItem {
  videoId: string;
  position: number; // 1-based position in playlist
  addedAt: Date;
  addedBy: string; // User who added this item

  // Episode-specific metadata
  episodeMetadata?: {
    episodeNumber?: number; // 1, 2, 3...
    episodeTitle?: string; // "The Fall of Shiganshina"
    watchProgress?: number; // 0-1, watching progress percentage
    duration?: number; // Episode duration in seconds
    notes?: string; // User notes for this episode
  };
}

/**
 * Playlist creation request interface
 */
export interface CreatePlaylistRequest {
  name: string;
  description?: string;
  type: PlaylistType;
  isPublic?: boolean;
  metadata?: PlaylistMetadata;
  initialVideoIds?: string[];
}

/**
 * Playlist update request interface
 */
export interface UpdatePlaylistRequest {
  name?: string;
  description?: string;
  isPublic?: boolean;
  metadata?: PlaylistMetadata;
}

/**
 * Playlist search and filtering
 */
export interface PlaylistFilters {
  type?: PlaylistType;
  ownerId?: string;
  isPublic?: boolean;
  genre?: string[];
  searchQuery?: string;
  seriesName?: string;
  status?: 'ongoing' | 'completed' | 'hiatus';
}

/**
 * Playlist search filters for UI
 */
export interface PlaylistSearchFilters {
  query: string;
  types: PlaylistType[];
  genres: string[];
  isPublicOnly?: boolean;
}

/**
 * Playlist statistics and analytics
 */
export interface PlaylistStats {
  id: string;
  totalVideos: number;
  totalDuration: number; // Total duration in seconds
  totalViews: number; // Total view count across all videos
  completionRate: number; // 0-1, how many users complete the playlist
  averageRating?: number; // Average user rating if rating system exists
  lastUpdated: Date;
  popularityScore: number; // Algorithm-calculated popularity
}

/**
 * Bulk playlist operations
 */
export interface BulkPlaylistOperation {
  playlistIds: string[];
  operation: 'delete' | 'make_public' | 'make_private' | 'add_to_collection';
  options?: Record<string, any>;
}

/**
 * Playlist reordering operation
 */
export interface ReorderPlaylistRequest {
  playlistId: string;
  newOrder: string[]; // New order of video IDs
}

/**
 * Add video to playlist request
 */
export interface AddVideoToPlaylistRequest {
  playlistId: string;
  videoId: string;
  position?: number; // Optional position, defaults to end
  episodeMetadata?: PlaylistItem['episodeMetadata'];
}

/**
 * Remove video from playlist request
 */
export interface RemoveVideoFromPlaylistRequest {
  playlistId: string;
  videoId: string;
}

/**
 * Playlist library interface (similar to VideoLibrary)
 */
export interface PlaylistLibrary {
  playlists: Playlist[];
  stats: PlaylistStats[];
}

/**
 * Playlist with populated video data for display
 */
export interface PlaylistWithVideos extends Playlist {
  videos: Array<{
    id: string;
    title: string;
    thumbnailUrl?: string;
    duration: number;
    position: number;
    episodeMetadata?: PlaylistItem['episodeMetadata'];
  }>;
  stats?: PlaylistStats;
}
