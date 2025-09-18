import { InternalError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  DuplicateVideoInPlaylistError,
  InvalidPlaylistPositionError,
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
} from '../../domain/playlist.errors';
import type {
  AddVideoToPlaylistDependencies,
  AddVideoToPlaylistUseCaseRequest,
  AddVideoToPlaylistUseCaseResponse,
} from './add-video-to-playlist.types';

/**
 * Use case for adding videos to playlists
 * Handles validation, permission checking, and video addition business logic
 */
export class AddVideoToPlaylistUseCase extends UseCase<AddVideoToPlaylistUseCaseRequest, AddVideoToPlaylistUseCaseResponse> {
  constructor(private readonly deps: AddVideoToPlaylistDependencies) {
    super();
  }

  async execute(request: AddVideoToPlaylistUseCaseRequest): Promise<Result<AddVideoToPlaylistUseCaseResponse>> {
    const { playlistId, videoId, userId, position, episodeMetadata } = request;

    try {
      // 1. Validate input
      const validation = this.validate(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Check if playlist exists
      const existingPlaylist = await this.deps.playlistRepository.findById(playlistId);
      if (!existingPlaylist) {
        this.deps.logger?.error('Playlist not found for video addition', { playlistId });
        return Result.fail(new PlaylistNotFoundError(playlistId));
      }

      // 3. Check ownership (only owner can modify playlist)
      if (existingPlaylist.ownerId !== userId) {
        this.deps.logger?.warn('User attempted to add video to playlist they do not own', {
          playlistId,
          userId,
          ownerId: existingPlaylist.ownerId,
        });
        return Result.fail(new PlaylistPermissionDeniedError(playlistId, userId, 'add video to'));
      }

      // 4. Check if video exists
      const video = await this.deps.videoRepository.findById(videoId);
      if (!video) {
        this.deps.logger?.error('Video not found for playlist addition', { videoId });
        return Result.fail(new ValidationError(`Video with ID "${videoId}" not found`));
      }

      // 5. Check for duplicate video in playlist
      if (existingPlaylist.videoIds.includes(videoId)) {
        this.deps.logger?.warn('Attempted to add duplicate video to playlist', {
          playlistId,
          videoId,
          userId,
        });
        return Result.fail(new DuplicateVideoInPlaylistError(videoId, playlistId));
      }

      // 6. Validate position if provided
      const finalPosition = this.validateAndCalculatePosition(position, existingPlaylist.videoIds.length);
      if (!finalPosition.success) {
        return finalPosition;
      }

      // 7. Add video to playlist through repository
      try {
        await this.deps.playlistRepository.addVideoToPlaylist(playlistId, videoId, finalPosition.data);

        // 8. Update playlist metadata if this is for a series/season
        await this.updatePlaylistMetadataIfNeeded(existingPlaylist, episodeMetadata);

        // 9. Get updated playlist for final response
        const updatedPlaylist = await this.deps.playlistRepository.findById(playlistId);
        const totalVideos = updatedPlaylist?.videoIds.length || existingPlaylist.videoIds.length + 1;

        // 10. Log successful addition
        this.deps.logger?.info('Video added to playlist successfully', {
          playlistId,
          videoId,
          finalPosition: finalPosition.data,
          totalVideos,
          userId,
        });

        // 11. Return success response
        return Result.ok({
          success: true,
          message: `Video "${video.title}" added to playlist "${existingPlaylist.name}" successfully`,
          playlistName: existingPlaylist.name,
          videoTitle: video.title,
          finalPosition: finalPosition.data,
          totalVideosInPlaylist: totalVideos,
        });
      }
      catch (repositoryError) {
        this.deps.logger?.error('Failed to add video to playlist', repositoryError);
        return Result.fail(new InternalError('Failed to add video to playlist in repository'));
      }
    }
    catch (error) {
      this.deps.logger?.error('Unexpected error in AddVideoToPlaylistUseCase', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to add video to playlist',
        ),
      );
    }
  }

  /**
   * Validate the add video to playlist request
   */
  private validate(request: AddVideoToPlaylistUseCaseRequest): Result<void> {
    // Check required fields
    if (!request.playlistId || !request.videoId || !request.userId) {
      return Result.fail(new ValidationError('Playlist ID, video ID, and user ID are required'));
    }

    // Validate playlist ID format
    if (request.playlistId.trim().length === 0) {
      return Result.fail(new ValidationError('Playlist ID cannot be empty'));
    }

    // Validate video ID format
    if (request.videoId.trim().length === 0) {
      return Result.fail(new ValidationError('Video ID cannot be empty'));
    }

    // Validate user ID format
    if (request.userId.trim().length === 0) {
      return Result.fail(new ValidationError('User ID cannot be empty'));
    }

    // Validate position if provided
    if (request.position !== undefined && request.position < 0) {
      return Result.fail(new ValidationError('Position must be a non-negative integer'));
    }

    // Validate episode metadata if provided
    if (request.episodeMetadata) {
      const metadataValidation = this.validateEpisodeMetadata(request.episodeMetadata);
      if (!metadataValidation.success) {
        return metadataValidation;
      }
    }

    return Result.ok(undefined);
  }

  /**
   * Validate episode metadata
   */
  private validateEpisodeMetadata(metadata: any): Result<void> {
    if (metadata.episodeNumber !== undefined && metadata.episodeNumber < 1) {
      return Result.fail(new ValidationError('Episode number must be a positive integer'));
    }

    if (metadata.episodeTitle !== undefined && metadata.episodeTitle.trim().length > 255) {
      return Result.fail(new ValidationError('Episode title cannot exceed 255 characters'));
    }

    if (metadata.watchProgress !== undefined && (metadata.watchProgress < 0 || metadata.watchProgress > 1)) {
      return Result.fail(new ValidationError('Watch progress must be between 0 and 1'));
    }

    if (metadata.duration !== undefined && metadata.duration < 0) {
      return Result.fail(new ValidationError('Duration must be a non-negative number'));
    }

    if (metadata.notes !== undefined && metadata.notes.trim().length > 1000) {
      return Result.fail(new ValidationError('Notes cannot exceed 1000 characters'));
    }

    return Result.ok(undefined);
  }

  /**
   * Validate position and calculate final position
   */
  private validateAndCalculatePosition(position: number | undefined, currentLength: number): Result<number> {
    if (position === undefined) {
      // Default to end of playlist
      return Result.ok(currentLength);
    }

    // Validate position range (0-based indexing, but position can be at the end)
    if (position < 0 || position > currentLength) {
      return Result.fail(new InvalidPlaylistPositionError(position, currentLength));
    }

    return Result.ok(position);
  }

  /**
   * Update playlist metadata if needed (for series/season playlists)
   */
  private async updatePlaylistMetadataIfNeeded(playlist: any, episodeMetadata?: any) {
    if (!playlist.metadata || (playlist.type !== 'series' && playlist.type !== 'season')) {
      return; // No metadata updates needed for regular playlists
    }

    try {
      const updates: any = {};

      // Update episode count for series/season playlists
      if (playlist.type === 'series' || playlist.type === 'season') {
        const newEpisodeCount = playlist.videoIds.length + 1;
        updates.metadata = {
          ...playlist.metadata,
          episodeCount: newEpisodeCount,
        };

        // If this is a season, also update the parent series
        if (playlist.type === 'season' && playlist.metadata.parentPlaylistId) {
          await this.updateParentSeriesEpisodeCount(playlist.metadata.parentPlaylistId);
        }
      }

      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        await this.deps.playlistRepository.update(playlist.id, updates);
      }
    }
    catch (error) {
      this.deps.logger?.warn('Failed to update playlist metadata after video addition', {
        playlistId: playlist.id,
        error,
      });
      // Don't fail the entire operation if metadata update fails
    }
  }

  /**
   * Update parent series episode count when adding to a season
   */
  private async updateParentSeriesEpisodeCount(parentPlaylistId: string) {
    try {
      const parentSeries = await this.deps.playlistRepository.findById(parentPlaylistId);
      if (!parentSeries || parentSeries.type !== 'series') {
        return;
      }

      // Calculate total episodes across all seasons
      const allSeasons = await this.deps.playlistRepository.findBySeries(parentSeries.metadata?.seriesName || '');
      const totalEpisodes = allSeasons
        .filter(s => s.type === 'season')
        .reduce((total, season) => total + (season.metadata?.episodeCount || 0), 0);

      await this.deps.playlistRepository.update(parentPlaylistId, {
        metadata: {
          ...parentSeries.metadata,
          episodeCount: totalEpisodes,
        },
      });
    }
    catch (error) {
      this.deps.logger?.warn('Failed to update parent series episode count', {
        parentPlaylistId,
        error,
      });
    }
  }
}
