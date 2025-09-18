import { InternalError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  EmptyPlaylistError,
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
} from '../../domain/playlist.errors';
import type {
  DeletePlaylistDependencies,
  DeletePlaylistUseCaseRequest,
  DeletePlaylistUseCaseResponse,
} from './delete-playlist.types';

/**
 * Use case for deleting playlists
 * Handles validation, ownership checking, and cleanup of related data
 */
export class DeletePlaylistUseCase extends UseCase<DeletePlaylistUseCaseRequest, DeletePlaylistUseCaseResponse> {
  constructor(private readonly deps: DeletePlaylistDependencies) {
    super();
  }

  async execute(request: DeletePlaylistUseCaseRequest): Promise<Result<DeletePlaylistUseCaseResponse>> {
    const { playlistId, userId, force = false } = request;

    try {
      // 1. Validate input
      const validation = this.validate(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Check if playlist exists
      const existingPlaylist = await this.deps.playlistRepository.findById(playlistId);
      if (!existingPlaylist) {
        this.deps.logger?.error('Playlist not found for deletion', { playlistId });
        return Result.fail(new PlaylistNotFoundError(playlistId));
      }

      // 3. Check ownership
      if (existingPlaylist.ownerId !== userId) {
        this.deps.logger?.warn('User attempted to delete playlist they do not own', {
          playlistId,
          userId,
          ownerId: existingPlaylist.ownerId,
        });
        return Result.fail(new PlaylistPermissionDeniedError(playlistId, userId, 'delete'));
      }

      // 4. Check for related playlists (series/season relationships)
      const relatedPlaylistsAffected = await this.findRelatedPlaylists(existingPlaylist);

      // 5. Validate deletion constraints
      if (!force && existingPlaylist.videoIds.length > 0) {
        this.deps.logger?.warn('Attempted to delete playlist with videos without force flag', {
          playlistId,
          videoCount: existingPlaylist.videoIds.length,
        });
        // For now, we'll allow deletion of playlists with videos
        // In a future version, we might want to add stricter controls
      }

      // 6. Store information for response before deletion
      const playlistName = existingPlaylist.name;
      const videosAffected = existingPlaylist.videoIds.length;

      // 7. Delete playlist through repository
      try {
        const success = await this.deps.playlistRepository.delete(playlistId);

        if (!success) {
          this.deps.logger?.error('Failed to delete playlist in repository', { playlistId });
          return Result.fail(new InternalError('Failed to delete playlist'));
        }

        // 8. Update related playlists if necessary
        await this.handleRelatedPlaylistsCleanup(relatedPlaylistsAffected, existingPlaylist);

        // 9. Log successful deletion
        this.deps.logger?.info('Playlist deleted successfully', {
          playlistId,
          playlistName,
          videosAffected,
          relatedPlaylistsAffected: relatedPlaylistsAffected.map(p => p.id),
          userId,
        });

        // 10. Return success response
        return Result.ok({
          success: true,
          message: `Playlist "${playlistName}" deleted successfully`,
          deletedPlaylistName: playlistName,
          videosAffected,
          relatedPlaylistsAffected: relatedPlaylistsAffected.map(p => p.id),
        });
      }
      catch (repositoryError) {
        this.deps.logger?.error('Failed to delete playlist', repositoryError);
        return Result.fail(new InternalError('Failed to delete playlist in repository'));
      }
    }
    catch (error) {
      this.deps.logger?.error('Unexpected error in DeletePlaylistUseCase', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to delete playlist',
        ),
      );
    }
  }

  /**
   * Validate the delete playlist request
   */
  private validate(request: DeletePlaylistUseCaseRequest): Result<void> {
    // Check required fields
    if (!request.playlistId || !request.userId) {
      return Result.fail(new ValidationError('Playlist ID and user ID are required'));
    }

    // Validate playlist ID format (basic UUID check)
    if (request.playlistId.trim().length === 0) {
      return Result.fail(new ValidationError('Playlist ID cannot be empty'));
    }

    // Validate user ID format
    if (request.userId.trim().length === 0) {
      return Result.fail(new ValidationError('User ID cannot be empty'));
    }

    return Result.ok(undefined);
  }

  /**
   * Find playlists related to this one (series/season relationships)
   */
  private async findRelatedPlaylists(playlist: any) {
    const relatedPlaylists = [];

    try {
      // If this is a series playlist, find all seasons
      if (playlist.type === 'series' && playlist.metadata?.seriesName) {
        const seasons = await this.deps.playlistRepository.findBySeries(playlist.metadata.seriesName);
        relatedPlaylists.push(...seasons.filter(s => s.id !== playlist.id && s.type === 'season'));
      }

      // If this is a season playlist, find the parent series
      if (playlist.type === 'season' && playlist.metadata?.parentPlaylistId) {
        const parentSeries = await this.deps.playlistRepository.findById(playlist.metadata.parentPlaylistId);
        if (parentSeries) {
          relatedPlaylists.push(parentSeries);
        }
      }
    }
    catch (error) {
      this.deps.logger?.warn('Failed to find related playlists', { playlistId: playlist.id, error });
    }

    return relatedPlaylists;
  }

  /**
   * Handle cleanup of related playlists after deletion
   */
  private async handleRelatedPlaylistsCleanup(relatedPlaylists: any[], deletedPlaylist: any) {
    if (relatedPlaylists.length === 0) return;

    try {
      // If we deleted a series, we might want to update or delete related seasons
      if (deletedPlaylist.type === 'series') {
        for (const season of relatedPlaylists) {
          if (season.type === 'season') {
            // Update season to remove parent reference
            await this.deps.playlistRepository.update(season.id, {
              metadata: {
                ...season.metadata,
                parentPlaylistId: undefined,
              },
            });
          }
        }
      }

      // If we deleted a season, we might want to update the parent series episode count
      if (deletedPlaylist.type === 'season' && relatedPlaylists.length > 0) {
        const parentSeries = relatedPlaylists[0];
        if (parentSeries.type === 'series') {
          // Recalculate episode count for the series
          const remainingSeasons = await this.deps.playlistRepository.findBySeries(parentSeries.metadata?.seriesName || '');
          const totalEpisodes = remainingSeasons
            .filter(s => s.type === 'season' && s.id !== deletedPlaylist.id)
            .reduce((total, season) => total + (season.metadata?.episodeCount || 0), 0);

          await this.deps.playlistRepository.update(parentSeries.id, {
            metadata: {
              ...parentSeries.metadata,
              episodeCount: totalEpisodes,
            },
          });
        }
      }
    }
    catch (error) {
      this.deps.logger?.error('Failed to cleanup related playlists', {
        deletedPlaylistId: deletedPlaylist.id,
        relatedPlaylistIds: relatedPlaylists.map(p => p.id),
        error,
      });
      // Don't fail the entire operation if cleanup fails
    }
  }
}
