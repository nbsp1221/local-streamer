import { InternalError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import type { Playlist, PlaylistFilters } from '../../domain/playlist.types';
import type {
  FindPlaylistsDependencies,
  FindPlaylistsUseCaseRequest,
  FindPlaylistsUseCaseResponse,
} from './find-playlists.types';

/**
 * Query use case for finding and filtering playlists
 * Handles search, filtering, sorting, and pagination
 */
export class FindPlaylistsUseCase extends UseCase<FindPlaylistsUseCaseRequest, FindPlaylistsUseCaseResponse> {
  constructor(private readonly deps: FindPlaylistsDependencies) {
    super();
  }

  async execute(request: FindPlaylistsUseCaseRequest): Promise<Result<FindPlaylistsUseCaseResponse>> {
    const {
      userId,
      filters = {},
      sortBy = 'updatedAt',
      sortOrder = 'desc',
      limit = 20,
      offset = 0,
      includeStats = false,
      includeEmpty = true,
    } = request;

    try {
      // 1. Validate input
      const validation = this.validate(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Prepare effective filters based on user permissions
      const effectiveFilters = await this.prepareEffectiveFilters(filters, userId);

      // 3. Find playlists through repository
      try {
        const allPlaylists = await this.deps.playlistRepository.findWithFilters(effectiveFilters);

        // 4. Filter empty playlists if needed
        const filteredPlaylists = includeEmpty
          ? allPlaylists
          : allPlaylists.filter(playlist => playlist.videoIds.length > 0);

        // 5. Sort playlists
        const sortedPlaylists = this.sortPlaylists(filteredPlaylists, sortBy, sortOrder);

        // 6. Apply pagination
        const totalCount = sortedPlaylists.length;
        const startIndex = Math.max(0, offset);
        const endIndex = Math.min(startIndex + limit, totalCount);
        const paginatedPlaylists = sortedPlaylists.slice(startIndex, endIndex);

        // 7. Calculate pagination info
        const totalPages = Math.ceil(totalCount / limit);
        const currentPage = Math.floor(offset / limit) + 1;
        const hasMore = endIndex < totalCount;

        // 8. Get stats if requested
        let stats = undefined;
        if (includeStats && paginatedPlaylists.length > 0) {
          stats = await this.getPlaylistStats(paginatedPlaylists);
        }

        // 9. Log successful query
        this.deps.logger?.info('Playlists found successfully', {
          totalCount,
          returnedCount: paginatedPlaylists.length,
          filters: effectiveFilters,
          sortBy,
          sortOrder,
          userId: userId || 'anonymous',
        });

        // 10. Return success response
        return Result.ok({
          playlists: paginatedPlaylists,
          stats,
          totalCount,
          hasMore,
          filters: effectiveFilters,
          pagination: {
            limit,
            offset,
            totalPages,
            currentPage,
          },
        });
      }
      catch (repositoryError) {
        this.deps.logger?.error('Failed to find playlists', repositoryError);
        return Result.fail(new InternalError('Failed to find playlists in repository'));
      }
    }
    catch (error) {
      this.deps.logger?.error('Unexpected error in FindPlaylistsUseCase', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to find playlists',
        ),
      );
    }
  }

  /**
   * Validate the find playlists request
   */
  private validate(request: FindPlaylistsUseCaseRequest): Result<void> {
    // Validate limit
    if (request.limit !== undefined) {
      if (request.limit < 1 || request.limit > 100) {
        return Result.fail(new ValidationError('Limit must be between 1 and 100'));
      }
    }

    // Validate offset
    if (request.offset !== undefined && request.offset < 0) {
      return Result.fail(new ValidationError('Offset must be non-negative'));
    }

    // Validate sort options
    const validSortFields = ['name', 'createdAt', 'updatedAt', 'videoCount', 'popularity'];
    if (request.sortBy && !validSortFields.includes(request.sortBy)) {
      return Result.fail(new ValidationError(`Sort field must be one of: ${validSortFields.join(', ')}`));
    }

    const validSortOrders = ['asc', 'desc'];
    if (request.sortOrder && !validSortOrders.includes(request.sortOrder)) {
      return Result.fail(new ValidationError('Sort order must be "asc" or "desc"'));
    }

    // Validate user ID if provided
    if (request.userId !== undefined && request.userId.trim().length === 0) {
      return Result.fail(new ValidationError('User ID cannot be empty if provided'));
    }

    return Result.ok(undefined);
  }

  /**
   * Prepare effective filters based on user permissions and access rights
   */
  private async prepareEffectiveFilters(
    inputFilters: PlaylistFilters,
    userId?: string,
  ): Promise<PlaylistFilters> {
    const effectiveFilters: PlaylistFilters = { ...inputFilters };

    // If no user is provided, only show public playlists
    if (!userId) {
      effectiveFilters.isPublic = true;
    }
    else {
      // If user is provided, respect the isPublic filter
      // If no isPublic filter is specified, show both public and user's private playlists
      if (effectiveFilters.isPublic === undefined) {
        // We'll handle this in the filtering logic to show both public playlists
        // and user's own private playlists
        delete effectiveFilters.isPublic;
      }
    }

    return effectiveFilters;
  }

  /**
   * Sort playlists based on specified criteria
   */
  private sortPlaylists(
    playlists: Playlist[],
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): Playlist[] {
    const sorted = [...playlists].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
        case 'videoCount':
          comparison = a.videoIds.length - b.videoIds.length;
          break;
        case 'popularity':
          // For now, use video count as popularity metric
          // In future, this could be based on view counts, likes, etc.
          comparison = a.videoIds.length - b.videoIds.length;
          break;
        default:
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }

  /**
   * Get playlist statistics for the given playlists
   */
  private async getPlaylistStats(playlists: Playlist[]) {
    // This is a placeholder for future stats functionality
    // In a full implementation, this would fetch detailed statistics
    // such as view counts, ratings, completion rates, etc.

    try {
      const stats = playlists.map(playlist => ({
        id: playlist.id,
        totalVideos: playlist.videoIds.length,
        totalDuration: 0, // Would be calculated from actual video durations
        totalViews: 0, // Would be fetched from analytics
        completionRate: 0, // Would be calculated from user watch data
        lastUpdated: playlist.updatedAt,
        popularityScore: playlist.videoIds.length, // Simple metric for now
      }));

      return stats;
    }
    catch (error) {
      this.deps.logger?.warn('Failed to fetch playlist stats', { error });
      return undefined;
    }
  }
}
