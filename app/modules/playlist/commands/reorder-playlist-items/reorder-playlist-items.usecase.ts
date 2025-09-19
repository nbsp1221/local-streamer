import { InternalError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
  PlaylistReorderError,
} from '../../domain/playlist.errors';
import type {
  ReorderPlaylistItemsDependencies,
  ReorderPlaylistItemsUseCaseRequest,
  ReorderPlaylistItemsUseCaseResponse,
} from './reorder-playlist-items.types';

/**
 * Use case for reordering videos in playlists
 * Handles validation, permission checking, and reordering business logic
 */
export class ReorderPlaylistItemsUseCase extends UseCase<ReorderPlaylistItemsUseCaseRequest, ReorderPlaylistItemsUseCaseResponse> {
  constructor(private readonly deps: ReorderPlaylistItemsDependencies) {
    super();
  }

  async execute(request: ReorderPlaylistItemsUseCaseRequest): Promise<Result<ReorderPlaylistItemsUseCaseResponse>> {
    const { playlistId, userId, newOrder, preserveMetadata = true } = request;

    try {
      // 1. Validate input
      const validation = this.validate(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Check if playlist exists
      const existingPlaylist = await this.deps.playlistRepository.findById(playlistId);
      if (!existingPlaylist) {
        this.deps.logger?.error('Playlist not found for reordering', { playlistId });
        return Result.fail(new PlaylistNotFoundError(playlistId));
      }

      // 3. Check ownership
      if (existingPlaylist.ownerId !== userId) {
        this.deps.logger?.warn('User attempted to reorder playlist they do not own', {
          playlistId,
          userId,
          ownerId: existingPlaylist.ownerId,
        });
        return Result.fail(new PlaylistPermissionDeniedError(playlistId, userId, 'reorder'));
      }

      // 4. Validate new order against current playlist
      const orderValidation = this.validateNewOrder(newOrder, existingPlaylist.videoIds);
      if (!orderValidation.success) {
        return orderValidation;
      }

      // 5. Check if there are actual changes
      if (this.arraysEqual(existingPlaylist.videoIds, newOrder)) {
        this.deps.logger?.info('No changes detected in playlist reorder', { playlistId });
        return Result.ok({
          success: true,
          message: 'No changes were made to the playlist order',
          playlistName: existingPlaylist.name,
          videosReordered: 0,
          oldOrder: existingPlaylist.videoIds,
          newOrder: newOrder,
        });
      }

      // 6. Store old order for response
      const oldOrder = [...existingPlaylist.videoIds];

      // 7. Reorder playlist through repository
      try {
        await this.deps.playlistRepository.reorderPlaylistItems(playlistId, newOrder);

        // 8. Update episode metadata if needed
        if (preserveMetadata && (existingPlaylist.type === 'series' || existingPlaylist.type === 'season')) {
          await this.updateEpisodeMetadataAfterReorder(existingPlaylist, oldOrder, newOrder);
        }

        // 9. Log successful reorder
        this.deps.logger?.info('Playlist reordered successfully', {
          playlistId,
          videosReordered: newOrder.length,
          userId,
        });

        // 10. Return success response
        return Result.ok({
          success: true,
          message: `Playlist "${existingPlaylist.name}" reordered successfully`,
          playlistName: existingPlaylist.name,
          videosReordered: newOrder.length,
          oldOrder,
          newOrder,
        });
      }
      catch (repositoryError) {
        this.deps.logger?.error('Failed to reorder playlist', repositoryError);
        return Result.fail(new InternalError('Failed to reorder playlist in repository'));
      }
    }
    catch (error) {
      this.deps.logger?.error('Unexpected error in ReorderPlaylistItemsUseCase', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to reorder playlist',
        ),
      );
    }
  }

  /**
   * Validate the reorder playlist items request
   */
  private validate(request: ReorderPlaylistItemsUseCaseRequest): Result<void> {
    // Check required fields
    if (!request.playlistId || !request.userId || !request.newOrder) {
      return Result.fail(new ValidationError('Playlist ID, user ID, and new order are required'));
    }

    // Validate playlist ID format
    if (request.playlistId.trim().length === 0) {
      return Result.fail(new ValidationError('Playlist ID cannot be empty'));
    }

    // Validate user ID format
    if (request.userId.trim().length === 0) {
      return Result.fail(new ValidationError('User ID cannot be empty'));
    }

    // Validate new order array
    if (!Array.isArray(request.newOrder)) {
      return Result.fail(new ValidationError('New order must be an array'));
    }

    if (request.newOrder.length === 0) {
      return Result.fail(new ValidationError('New order cannot be empty'));
    }

    // Check for duplicate video IDs in new order
    const uniqueIds = new Set(request.newOrder);
    if (uniqueIds.size !== request.newOrder.length) {
      return Result.fail(new PlaylistReorderError('New order contains duplicate video IDs'));
    }

    // Validate individual video IDs
    for (const videoId of request.newOrder) {
      if (!videoId || typeof videoId !== 'string' || videoId.trim().length === 0) {
        return Result.fail(new ValidationError('All video IDs in new order must be non-empty strings'));
      }
    }

    return Result.ok(undefined);
  }

  /**
   * Validate that new order contains exactly the same videos as current playlist
   */
  private validateNewOrder(newOrder: string[], currentOrder: string[]): Result<void> {
    // Check if lengths match
    if (newOrder.length !== currentOrder.length) {
      return Result.fail(new PlaylistReorderError(
        `New order has ${newOrder.length} videos, but playlist has ${currentOrder.length} videos`,
      ));
    }

    // Check if all videos in new order exist in current playlist
    const currentSet = new Set(currentOrder);
    const newSet = new Set(newOrder);

    if (currentSet.size !== newSet.size) {
      return Result.fail(new PlaylistReorderError('New order contains different videos than current playlist'));
    }

    // Check if every video in new order exists in current playlist
    for (const videoId of newOrder) {
      if (!currentSet.has(videoId)) {
        return Result.fail(new PlaylistReorderError(`Video "${videoId}" in new order is not in current playlist`));
      }
    }

    // Check if every video in current playlist exists in new order
    for (const videoId of currentOrder) {
      if (!newSet.has(videoId)) {
        return Result.fail(new PlaylistReorderError(`Video "${videoId}" from current playlist is missing in new order`));
      }
    }

    return Result.ok(undefined);
  }

  /**
   * Check if two arrays are equal
   */
  private arraysEqual(arr1: string[], arr2: string[]): boolean {
    if (arr1.length !== arr2.length) {
      return false;
    }

    for (let i = 0; i < arr1.length; i++) {
      if (arr1[i] !== arr2[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update episode metadata after reordering (for series/season playlists)
   */
  private async updateEpisodeMetadataAfterReorder(
    playlist: any,
    oldOrder: string[],
    newOrder: string[],
  ) {
    if (playlist.type !== 'series' && playlist.type !== 'season') {
      return; // No episode metadata to update for regular playlists
    }

    try {
      // For series/season playlists, we might want to update episode numbers
      // based on the new order. This is a placeholder for future enhancement.

      // In a full implementation, we would:
      // 1. Fetch episode metadata for each video
      // 2. Recalculate episode numbers based on new positions
      // 3. Update the metadata accordingly

      this.deps.logger?.info('Episode metadata preserved after reorder', {
        playlistId: playlist.id,
        type: playlist.type,
      });

      // For now, we'll just log that metadata was preserved
      // Future implementation could include:
      // - Auto-updating episode numbers based on position
      // - Preserving custom episode titles and metadata
      // - Updating series-level metadata if needed
    }
    catch (error) {
      this.deps.logger?.warn('Failed to update episode metadata after reorder', {
        playlistId: playlist.id,
        error,
      });
      // Don't fail the entire operation if metadata update fails
    }
  }
}
