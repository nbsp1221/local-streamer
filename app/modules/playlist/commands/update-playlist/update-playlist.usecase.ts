import { InternalError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  DuplicatePlaylistNameError,
  InvalidPlaylistDataError,
  InvalidSeriesMetadataError,
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
} from '../../domain/playlist.errors';
import type {
  UpdatePlaylistDependencies,
  UpdatePlaylistUseCaseRequest,
  UpdatePlaylistUseCaseResponse,
} from './update-playlist.types';

/**
 * Use case for updating existing playlists
 * Handles validation, ownership checking, and playlist update business logic
 */
export class UpdatePlaylistUseCase extends UseCase<UpdatePlaylistUseCaseRequest, UpdatePlaylistUseCaseResponse> {
  constructor(private readonly deps: UpdatePlaylistDependencies) {
    super();
  }

  async execute(request: UpdatePlaylistUseCaseRequest): Promise<Result<UpdatePlaylistUseCaseResponse>> {
    const { playlistId, userId, ...updateData } = request;

    try {
      // 1. Validate input
      const validation = this.validate(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Check if playlist exists
      const existingPlaylist = await this.deps.playlistRepository.findById(playlistId);
      if (!existingPlaylist) {
        this.deps.logger?.error('Playlist not found for update', { playlistId });
        return Result.fail(new PlaylistNotFoundError(playlistId));
      }

      // 3. Check ownership
      if (existingPlaylist.ownerId !== userId) {
        this.deps.logger?.warn('User attempted to update playlist they do not own', {
          playlistId,
          userId,
          ownerId: existingPlaylist.ownerId,
        });
        return Result.fail(new PlaylistPermissionDeniedError(playlistId, userId, 'update'));
      }

      // 4. Check for duplicate playlist name if name is being updated
      if (updateData.name && updateData.name !== existingPlaylist.name) {
        const nameExists = await this.deps.playlistRepository.nameExistsForUser(
          updateData.name,
          userId,
          playlistId,
        );

        if (nameExists) {
          this.deps.logger?.warn('Playlist name already exists during update', {
            name: updateData.name,
            userId,
            playlistId,
          });
          return Result.fail(new DuplicatePlaylistNameError(updateData.name, userId));
        }
      }

      // 5. Validate metadata if provided
      if (updateData.metadata) {
        const metadataValidation = this.validateMetadata(request, existingPlaylist.type);
        if (!metadataValidation.success) {
          return metadataValidation;
        }
      }

      // 6. Prepare update data with only changed fields
      const fieldsUpdated: string[] = [];
      const updateInput: any = {};

      if (updateData.name !== undefined && updateData.name !== existingPlaylist.name) {
        updateInput.name = updateData.name.trim();
        fieldsUpdated.push('name');
      }

      if (updateData.description !== undefined && updateData.description !== existingPlaylist.description) {
        updateInput.description = updateData.description?.trim();
        fieldsUpdated.push('description');
      }

      if (updateData.isPublic !== undefined && updateData.isPublic !== existingPlaylist.isPublic) {
        updateInput.isPublic = updateData.isPublic;
        fieldsUpdated.push('isPublic');
      }

      if (updateData.metadata !== undefined) {
        updateInput.metadata = {
          ...existingPlaylist.metadata,
          ...updateData.metadata,
        };
        fieldsUpdated.push('metadata');
      }

      // 7. Only update if there are actual changes
      if (fieldsUpdated.length === 0) {
        this.deps.logger?.info('No changes detected in playlist update', { playlistId });
        return Result.ok({
          playlist: existingPlaylist,
          message: 'No changes were made to the playlist',
          fieldsUpdated: [],
        });
      }

      // 8. Update playlist through repository
      try {
        const updatedPlaylist = await this.deps.playlistRepository.update(playlistId, updateInput);

        if (!updatedPlaylist) {
          this.deps.logger?.error('Failed to update playlist in repository', { playlistId });
          return Result.fail(new InternalError('Failed to update playlist'));
        }

        // 9. Log successful update
        this.deps.logger?.info('Playlist updated successfully', {
          playlistId,
          fieldsUpdated,
          userId,
        });

        // 10. Return success response
        return Result.ok({
          playlist: updatedPlaylist,
          message: `Playlist "${updatedPlaylist.name}" updated successfully`,
          fieldsUpdated,
        });
      }
      catch (repositoryError) {
        this.deps.logger?.error('Failed to update playlist', repositoryError);
        return Result.fail(new InternalError('Failed to update playlist in repository'));
      }
    }
    catch (error) {
      this.deps.logger?.error('Unexpected error in UpdatePlaylistUseCase', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to update playlist',
        ),
      );
    }
  }

  /**
   * Validate the update playlist request
   */
  private validate(request: UpdatePlaylistUseCaseRequest): Result<void> {
    // Check required fields
    if (!request.playlistId || !request.userId) {
      return Result.fail(new ValidationError('Playlist ID and user ID are required'));
    }

    // Check that at least one field is being updated
    const hasUpdates = request.name !== undefined ||
      request.description !== undefined ||
      request.isPublic !== undefined ||
      request.metadata !== undefined;

    if (!hasUpdates) {
      return Result.fail(new ValidationError('At least one field must be provided for update'));
    }

    // Validate name if provided
    if (request.name !== undefined) {
      if (request.name.trim().length === 0) {
        return Result.fail(new InvalidPlaylistDataError('name', 'cannot be empty'));
      }

      if (request.name.trim().length > 255) {
        return Result.fail(new InvalidPlaylistDataError('name', 'cannot exceed 255 characters'));
      }
    }

    // Validate description if provided
    if (request.description !== undefined && request.description && request.description.trim().length > 1000) {
      return Result.fail(new InvalidPlaylistDataError('description', 'cannot exceed 1000 characters'));
    }

    return Result.ok(undefined);
  }

  /**
   * Validate metadata for series and season playlists
   */
  private validateMetadata(request: UpdatePlaylistUseCaseRequest, playlistType: string): Result<void> {
    const metadata = request.metadata!;

    // Series name validation for series/season types
    if ((playlistType === 'series' || playlistType === 'season') && metadata.seriesName === '') {
      return Result.fail(new InvalidSeriesMetadataError('seriesName cannot be empty for series and season playlists'));
    }

    // Season number validation for season type
    if (playlistType === 'season' && metadata.seasonNumber !== undefined) {
      if (metadata.seasonNumber < 1) {
        return Result.fail(new InvalidSeriesMetadataError('seasonNumber must be a positive integer for season playlists'));
      }
    }

    // Episode count validation
    if (metadata.episodeCount !== undefined && metadata.episodeCount < 0) {
      return Result.fail(new InvalidSeriesMetadataError('episodeCount must be a non-negative integer'));
    }

    // Year validation
    if (metadata.year !== undefined) {
      const currentYear = new Date().getFullYear();
      if (metadata.year < 1900 || metadata.year > currentYear + 10) {
        return Result.fail(new InvalidSeriesMetadataError(`year must be between 1900 and ${currentYear + 10}`));
      }
    }

    // Genre validation
    if (metadata.genre && !Array.isArray(metadata.genre)) {
      return Result.fail(new InvalidSeriesMetadataError('genre must be an array of strings'));
    }

    // Status validation
    if (metadata.status && !['ongoing', 'completed', 'hiatus'].includes(metadata.status)) {
      return Result.fail(new InvalidSeriesMetadataError('status must be one of: ongoing, completed, hiatus'));
    }

    return Result.ok(undefined);
  }
}
