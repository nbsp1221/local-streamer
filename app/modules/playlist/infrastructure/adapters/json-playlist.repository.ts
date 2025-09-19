import { v4 as uuidv4 } from 'uuid';
import type {
  CreatePlaylistInput,
  PlaylistRepository,
  UpdatePlaylistInput,
} from '~/repositories/interfaces/PlaylistRepository';
import { config } from '~/configs';
import { BaseJsonRepository } from '~/repositories/base/BaseJsonRepository';
import type {
  Playlist,
  PlaylistFilters,
  PlaylistItem,
  PlaylistType,
} from '../../domain/playlist.types';

/**
 * JSON-based implementation of PlaylistRepository
 */
export class JsonPlaylistRepository
  extends BaseJsonRepository<Playlist, CreatePlaylistInput, UpdatePlaylistInput>
  implements PlaylistRepository {
  protected readonly filePath = config.paths.playlistsJson;

  /**
   * Transform raw JSON data to Playlist entity
   */
  protected transformFromJson(data: any): Playlist {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      videoIds: data.videoIds || [], // Ensure videoIds is always an array
    };
  }

  /**
   * Transform Playlist entity to JSON data
   */
  protected transformToJson(entity: Playlist): any {
    return {
      ...entity,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new Playlist entity from input data
   */
  protected createEntity(input: CreatePlaylistInput): Playlist {
    const now = new Date();
    return {
      id: input.id || uuidv4(),
      name: input.name,
      description: input.description,
      type: input.type,
      videoIds: input.videoIds || [],
      thumbnailUrl: input.thumbnailUrl,
      ownerId: input.ownerId,
      isPublic: input.isPublic ?? false, // Default to private
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };
  }

  /**
   * Override update to automatically set updatedAt timestamp
   */
  async update(id: string, updates: UpdatePlaylistInput): Promise<Playlist | null> {
    const result = await super.update(id, {
      ...updates,
      updatedAt: new Date(),
    } as any);
    return result;
  }

  // ========== Playlist-specific query methods ==========

  /**
   * Find playlists by owner ID
   */
  async findByOwner(ownerId: string): Promise<Playlist[]> {
    return this.findWhere(playlist => playlist.ownerId === ownerId);
  }

  /**
   * Find playlists by type
   */
  async findByType(type: PlaylistType): Promise<Playlist[]> {
    return this.findWhere(playlist => playlist.type === type);
  }

  /**
   * Find public playlists only
   */
  async findPublicPlaylists(): Promise<Playlist[]> {
    return this.findWhere(playlist => playlist.isPublic === true);
  }

  /**
   * Find playlists by series name (for series/season types)
   */
  async findBySeries(seriesName: string): Promise<Playlist[]> {
    return this.findWhere(
      playlist => playlist.metadata?.seriesName?.toLowerCase() === seriesName.toLowerCase(),
    );
  }

  /**
   * Search playlists with filters
   */
  async findWithFilters(filters: PlaylistFilters): Promise<Playlist[]> {
    return this.findWhere((playlist) => {
      // Type filter
      if (filters.type && playlist.type !== filters.type) {
        return false;
      }

      // Owner filter
      if (filters.ownerId && playlist.ownerId !== filters.ownerId) {
        return false;
      }

      // Public/private filter
      if (filters.isPublic !== undefined && playlist.isPublic !== filters.isPublic) {
        return false;
      }

      // Genre filter
      if (filters.genre && filters.genre.length > 0) {
        if (!playlist.metadata?.genre || !playlist.metadata.genre.some(g => filters.genre!.includes(g))) {
          return false;
        }
      }

      // Series name filter
      if (filters.seriesName && playlist.metadata?.seriesName !== filters.seriesName) {
        return false;
      }

      // Status filter
      if (filters.status && playlist.metadata?.status !== filters.status) {
        return false;
      }

      // Search query filter (name and description)
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const nameMatch = playlist.name.toLowerCase().includes(query);
        const descMatch = playlist.description?.toLowerCase().includes(query) || false;
        const genreMatch = playlist.metadata?.genre?.some(g => g.toLowerCase().includes(query)) || false;

        if (!nameMatch && !descMatch && !genreMatch) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Find playlists by name (case-insensitive partial match)
   */
  async findByName(name: string): Promise<Playlist[]> {
    const searchTerm = name.toLowerCase();
    return this.findWhere(playlist => playlist.name.toLowerCase().includes(searchTerm));
  }

  /**
   * Get all unique genres across all playlists
   */
  async getAllGenres(): Promise<string[]> {
    const playlists = await this.findAll();
    const genreSet = new Set<string>();

    playlists.forEach((playlist) => {
      playlist.metadata?.genre?.forEach(genre => genreSet.add(genre));
    });

    return Array.from(genreSet).sort();
  }

  /**
   * Search playlists by query (name, description, genre)
   */
  async search(query: string): Promise<Playlist[]> {
    return this.findWithFilters({ searchQuery: query });
  }

  /**
   * Check if playlist name exists for a user
   */
  async nameExistsForUser(name: string, ownerId: string, excludeId?: string): Promise<boolean> {
    const playlists = await this.findWhere(
      playlist => playlist.ownerId === ownerId &&
        playlist.name.toLowerCase() === name.toLowerCase() &&
        (!excludeId || playlist.id !== excludeId),
    );

    return playlists.length > 0;
  }

  /**
   * Get most popular playlists (by video count for now, can be enhanced with view metrics later)
   */
  async getMostPopular(limit: number): Promise<Playlist[]> {
    const playlists = await this.findPublicPlaylists();

    // Sort by video count (descending) and creation date (newest first)
    return playlists
      .sort((a, b) => {
        const videoCountDiff = b.videoIds.length - a.videoIds.length;
        if (videoCountDiff !== 0) return videoCountDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
      .slice(0, limit);
  }

  /**
   * Get recently created playlists
   */
  async getRecentlyCreated(limit: number): Promise<Playlist[]> {
    const playlists = await this.findPublicPlaylists();

    return playlists
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // ========== Video management methods ==========

  /**
   * Add video to playlist at specific position
   */
  async addVideoToPlaylist(playlistId: string, videoId: string, position?: number): Promise<void> {
    const playlist = await this.findById(playlistId);
    if (!playlist) {
      throw new Error(`Playlist with ID "${playlistId}" not found`);
    }

    // Check if video is already in playlist
    if (playlist.videoIds.includes(videoId)) {
      throw new Error(`Video "${videoId}" is already in playlist "${playlistId}"`);
    }

    // Add video at specified position or end
    if (position !== undefined && position >= 0 && position <= playlist.videoIds.length) {
      playlist.videoIds.splice(position, 0, videoId);
    }
    else {
      playlist.videoIds.push(videoId);
    }

    playlist.updatedAt = new Date();
    await this.update(playlistId, playlist);
  }

  /**
   * Remove video from playlist
   */
  async removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void> {
    const playlist = await this.findById(playlistId);
    if (!playlist) {
      throw new Error(`Playlist with ID "${playlistId}" not found`);
    }

    const index = playlist.videoIds.indexOf(videoId);
    if (index === -1) {
      throw new Error(`Video "${videoId}" not found in playlist "${playlistId}"`);
    }

    playlist.videoIds.splice(index, 1);
    playlist.updatedAt = new Date();
    await this.update(playlistId, playlist);
  }

  /**
   * Reorder videos in playlist
   */
  async reorderPlaylistItems(playlistId: string, newOrder: string[]): Promise<void> {
    const playlist = await this.findById(playlistId);
    if (!playlist) {
      throw new Error(`Playlist with ID "${playlistId}" not found`);
    }

    // Validate that newOrder contains the same videos as current playlist
    const currentSet = new Set(playlist.videoIds);
    const newSet = new Set(newOrder);

    if (currentSet.size !== newSet.size || [...currentSet].some(id => !newSet.has(id))) {
      throw new Error('New order must contain exactly the same videos as current playlist');
    }

    playlist.videoIds = newOrder;
    playlist.updatedAt = new Date();
    await this.update(playlistId, playlist);
  }

  /**
   * Get playlist with video details (placeholder - would need video repository integration)
   */
  async getPlaylistWithVideos(playlistId: string): Promise<Playlist & { videos: any[] } | null> {
    const playlist = await this.findById(playlistId);
    if (!playlist) return null;

    // For now, return playlist with empty videos array
    // This will be enhanced when integrated with video repository
    return {
      ...playlist,
      videos: [],
    };
  }

  /**
   * Get playlists containing a specific video
   */
  async findContainingVideo(videoId: string): Promise<Playlist[]> {
    return this.findWhere(playlist => playlist.videoIds.includes(videoId));
  }

  /**
   * Batch delete playlists
   */
  async batchDelete(playlistIds: string[]): Promise<{ successful: string[]; failed: string[] }> {
    const result = { successful: [] as string[], failed: [] as string[] };

    for (const playlistId of playlistIds) {
      try {
        const success = await this.delete(playlistId);
        if (success) {
          result.successful.push(playlistId);
        }
        else {
          result.failed.push(playlistId);
        }
      }
      catch (error) {
        result.failed.push(playlistId);
      }
    }

    return result;
  }

  /**
   * Update playlist access (make public/private)
   */
  async updateAccess(playlistId: string, isPublic: boolean): Promise<boolean> {
    const playlist = await this.update(playlistId, { isPublic });
    return playlist !== null;
  }
}
