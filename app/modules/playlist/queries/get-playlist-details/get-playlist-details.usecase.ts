import { InternalError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import type { PlaylistWithVideos } from '../../domain/playlist.types';
import {
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
} from '../../domain/playlist.errors';
import type {
  GetPlaylistDetailsDependencies,
  GetPlaylistDetailsUseCaseRequest,
  GetPlaylistDetailsUseCaseResponse,
} from './get-playlist-details.types';

/**
 * Query use case for getting detailed playlist information
 * Handles access control, video details, and related playlist information
 */
export class GetPlaylistDetailsUseCase extends UseCase<GetPlaylistDetailsUseCaseRequest, GetPlaylistDetailsUseCaseResponse> {
  constructor(private readonly deps: GetPlaylistDetailsDependencies) {
    super();
  }

  async execute(request: GetPlaylistDetailsUseCaseRequest): Promise<Result<GetPlaylistDetailsUseCaseResponse>> {
    const {
      playlistId,
      userId,
      includeVideos = true,
      includeStats = false,
      includeRelated = false,
      videoLimit = 50,
      videoOffset = 0,
    } = request;

    try {
      // 1. Validate input
      const validation = this.validate(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Check if playlist exists
      const playlist = await this.deps.playlistRepository.findById(playlistId);
      if (!playlist) {
        this.deps.logger?.error('Playlist not found for details query', { playlistId });
        return Result.fail(new PlaylistNotFoundError(playlistId));
      }

      // 3. Check access permissions
      const hasAccess = this.checkPlaylistAccess(playlist, userId);
      if (!hasAccess) {
        this.deps.logger?.warn('User attempted to access private playlist', {
          playlistId,
          userId: userId || 'anonymous',
          ownerId: playlist.ownerId,
        });
        return Result.fail(new PlaylistPermissionDeniedError(playlistId, userId || 'anonymous', 'view'));
      }

      // 4. Calculate user permissions
      const permissions = this.calculateUserPermissions(playlist, userId);

      // 5. Get video details if requested
      let playlistWithVideos: PlaylistWithVideos;
      let videoPagination;

      if (includeVideos) {
        const videoDetails = await this.getVideoDetails(playlist, videoLimit, videoOffset);
        playlistWithVideos = {
          ...playlist,
          videos: videoDetails.videos,
          stats: undefined, // Will be populated later if requested
        };
        videoPagination = videoDetails.pagination;
      }
      else {
        playlistWithVideos = {
          ...playlist,
          videos: [],
          stats: undefined,
        };
      }

      // 6. Get playlist statistics if requested
      let stats;
      if (includeStats) {
        stats = await this.getPlaylistStatistics(playlist);
        playlistWithVideos.stats = stats;
      }

      // 7. Get related playlists if requested
      let relatedPlaylists;
      if (includeRelated) {
        relatedPlaylists = await this.getRelatedPlaylists(playlist);
      }

      // 8. Log successful query
      this.deps.logger?.info('Playlist details retrieved successfully', {
        playlistId,
        includeVideos,
        includeStats,
        includeRelated,
        videoCount: includeVideos ? playlistWithVideos.videos.length : 0,
        userId: userId || 'anonymous',
      });

      // 9. Return success response
      return Result.ok({
        playlist: playlistWithVideos,
        stats,
        relatedPlaylists,
        videoPagination,
        permissions,
      });
    }
    catch (error) {
      this.deps.logger?.error('Unexpected error in GetPlaylistDetailsUseCase', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to get playlist details',
        ),
      );
    }
  }

  /**
   * Validate the get playlist details request
   */
  private validate(request: GetPlaylistDetailsUseCaseRequest): Result<void> {
    // Check required fields
    if (!request.playlistId) {
      return Result.fail(new ValidationError('Playlist ID is required'));
    }

    // Validate playlist ID format
    if (request.playlistId.trim().length === 0) {
      return Result.fail(new ValidationError('Playlist ID cannot be empty'));
    }

    // Validate user ID if provided
    if (request.userId !== undefined && request.userId.trim().length === 0) {
      return Result.fail(new ValidationError('User ID cannot be empty if provided'));
    }

    // Validate video pagination parameters
    if (request.videoLimit !== undefined) {
      if (request.videoLimit < 1 || request.videoLimit > 100) {
        return Result.fail(new ValidationError('Video limit must be between 1 and 100'));
      }
    }

    if (request.videoOffset !== undefined && request.videoOffset < 0) {
      return Result.fail(new ValidationError('Video offset must be non-negative'));
    }

    return Result.ok(undefined);
  }

  /**
   * Check if user has access to view the playlist
   */
  private checkPlaylistAccess(playlist: any, userId?: string): boolean {
    // Public playlists are accessible to everyone
    if (playlist.isPublic) {
      return true;
    }

    // Private playlists are only accessible to the owner
    if (!userId) {
      return false; // Anonymous users cannot access private playlists
    }

    return playlist.ownerId === userId;
  }

  /**
   * Calculate user permissions for the playlist
   */
  private calculateUserPermissions(playlist: any, userId?: string) {
    const isOwner = userId && playlist.ownerId === userId;

    return {
      canEdit: isOwner || false,
      canDelete: isOwner || false,
      canAddVideos: isOwner || false,
      canShare: playlist.isPublic || isOwner || false,
    };
  }

  /**
   * Get detailed video information for the playlist
   */
  private async getVideoDetails(playlist: any, limit: number, offset: number) {
    try {
      const totalVideos = playlist.videoIds.length;
      const startIndex = Math.max(0, offset);
      const endIndex = Math.min(startIndex + limit, totalVideos);
      const paginatedVideoIds = playlist.videoIds.slice(startIndex, endIndex);

      const videos = [];
      for (let i = 0; i < paginatedVideoIds.length; i++) {
        const videoId = paginatedVideoIds[i];
        try {
          const video = await this.deps.videoRepository.findById(videoId);
          if (video) {
            videos.push({
              id: video.id,
              title: video.title,
              thumbnailUrl: video.thumbnailUrl,
              duration: video.duration,
              position: startIndex + i + 1, // 1-based position
              episodeMetadata: undefined, // Could be enhanced to include episode data
            });
          }
          else {
            // Video not found, but keep position consistent
            this.deps.logger?.warn('Video not found in playlist', { videoId, playlistId: playlist.id });
          }
        }
        catch (videoError) {
          this.deps.logger?.warn('Failed to fetch video details', { videoId, error: videoError });
        }
      }

      const pagination = {
        total: totalVideos,
        limit,
        offset,
        hasMore: endIndex < totalVideos,
      };

      return { videos, pagination };
    }
    catch (error) {
      this.deps.logger?.error('Failed to get video details', { playlistId: playlist.id, error });
      return { videos: [], pagination: { total: 0, limit, offset, hasMore: false } };
    }
  }

  /**
   * Get playlist statistics
   */
  private async getPlaylistStatistics(playlist: any) {
    try {
      // This is a placeholder for future stats functionality
      // In a full implementation, this would fetch detailed statistics
      return {
        id: playlist.id,
        totalVideos: playlist.videoIds.length,
        totalDuration: 0, // Would be calculated from actual video durations
        totalViews: 0, // Would be fetched from analytics
        completionRate: 0, // Would be calculated from user watch data
        averageRating: undefined, // Would be calculated from user ratings
        lastUpdated: playlist.updatedAt,
        popularityScore: playlist.videoIds.length, // Simple metric for now
      };
    }
    catch (error) {
      this.deps.logger?.warn('Failed to get playlist statistics', { playlistId: playlist.id, error });
      return undefined;
    }
  }

  /**
   * Get related playlists (for series/season relationships)
   */
  private async getRelatedPlaylists(playlist: any) {
    try {
      const relatedPlaylists = [];

      // If this is a series, find all seasons
      if (playlist.type === 'series' && playlist.metadata?.seriesName) {
        const seasons = await this.deps.playlistRepository.findBySeries(playlist.metadata.seriesName);
        for (const season of seasons) {
          if (season.id !== playlist.id && season.type === 'season') {
            relatedPlaylists.push({
              id: season.id,
              name: season.name,
              type: season.type,
              videoCount: season.videoIds.length,
              relationship: 'child' as const,
            });
          }
        }
      }

      // If this is a season, find the parent series and sibling seasons
      if (playlist.type === 'season' && playlist.metadata?.seriesName) {
        const seriesPlaylists = await this.deps.playlistRepository.findBySeries(playlist.metadata.seriesName);

        for (const related of seriesPlaylists) {
          if (related.id !== playlist.id) {
            if (related.type === 'series') {
              relatedPlaylists.push({
                id: related.id,
                name: related.name,
                type: related.type,
                videoCount: related.videoIds.length,
                relationship: 'parent' as const,
              });
            }
            else if (related.type === 'season') {
              relatedPlaylists.push({
                id: related.id,
                name: related.name,
                type: related.type,
                videoCount: related.videoIds.length,
                relationship: 'sibling' as const,
              });
            }
          }
        }
      }

      return relatedPlaylists;
    }
    catch (error) {
      this.deps.logger?.warn('Failed to get related playlists', { playlistId: playlist.id, error });
      return [];
    }
  }
}
