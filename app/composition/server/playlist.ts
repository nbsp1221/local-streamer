import type {
  CreatePlaylistRequest,
  Playlist,
  PlaylistFilters,
  PlaylistMetadata,
  PlaylistStats,
  PlaylistWithVideos,
  UpdatePlaylistRequest,
} from '~/modules/playlist/domain/playlist';
import { CompatibilityPlaylistOwnerAdapter } from '~/modules/playlist/infrastructure/auth/compatibility-playlist-owner.adapter';
import { JsonPlaylistRepository } from '~/modules/playlist/infrastructure/json/json-playlist.repository';
import { SqlitePlaylistVideoCatalog } from '~/modules/playlist/infrastructure/video/sqlite-playlist-video-catalog.adapter';

type PlaylistFailure = {
  error: string;
  success: false;
  reason: string;
  status: number;
};

type PlaylistSuccess<T> = {
  data: T;
  success: true;
};

type PlaylistResult<T> = PlaylistFailure | PlaylistSuccess<T>;

interface FindPlaylistsInput {
  filters: PlaylistFilters;
  includeEmpty: boolean;
  includeStats: boolean;
  limit: number;
  offset: number;
  ownerId?: string;
  sortBy: 'name' | 'createdAt' | 'updatedAt' | 'videoCount' | 'popularity';
  sortOrder: 'asc' | 'desc';
}

interface GetPlaylistDetailsInput {
  includeRelated: boolean;
  includeStats: boolean;
  includeVideos: boolean;
  ownerId?: string;
  playlistId: string;
  videoLimit: number;
  videoOffset: number;
}

function ok<T>(data: T): PlaylistSuccess<T> {
  return { data, success: true };
}

function fail(reason: string, error: string, status: number): PlaylistFailure {
  return { error, reason, status, success: false };
}

function sortPlaylists(
  playlists: Playlist[],
  sortBy: FindPlaylistsInput['sortBy'],
  sortOrder: FindPlaylistsInput['sortOrder'],
) {
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
      case 'popularity':
        comparison = a.videoIds.length - b.videoIds.length;
        break;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });

  return sorted;
}

function calculateStats(playlist: Playlist): PlaylistStats {
  return {
    completionRate: 0,
    id: playlist.id,
    lastUpdated: playlist.updatedAt,
    popularityScore: playlist.videoIds.length,
    totalDuration: 0,
    totalVideos: playlist.videoIds.length,
    totalViews: 0,
  };
}

function checkPlaylistAccess(playlist: Playlist, ownerId?: string) {
  if (playlist.isPublic) {
    return true;
  }

  if (!ownerId) {
    return false;
  }

  return playlist.ownerId === ownerId;
}

function calculatePermissions(playlist: Playlist, ownerId?: string) {
  const isOwner = playlist.ownerId === ownerId;

  return {
    canAddVideos: isOwner,
    canDelete: isOwner,
    canEdit: isOwner,
    canShare: playlist.isPublic || isOwner,
  };
}

function getSuggestedMetadata(input: CreatePlaylistRequest) {
  if (input.type === 'user_created') {
    return undefined;
  }

  const suggestions: Partial<PlaylistMetadata> = {};

  if (input.type === 'series' && !input.metadata?.status) {
    suggestions.status = 'ongoing';
  }

  if (!input.metadata?.year) {
    suggestions.year = new Date().getFullYear();
  }

  return Object.keys(suggestions).length > 0 ? suggestions : undefined;
}

function validateCreateRequest(input: CreatePlaylistRequest) {
  if (!input.name?.trim() || !input.type) {
    return fail('INVALID_PLAYLIST_DATA', 'Playlist name and type are required', 400);
  }

  if (input.name.trim().length > 255) {
    return fail('INVALID_PLAYLIST_DATA', 'Invalid playlist name: cannot exceed 255 characters', 400);
  }

  if (input.description && input.description.trim().length > 1000) {
    return fail('INVALID_PLAYLIST_DATA', 'Invalid playlist description: cannot exceed 1000 characters', 400);
  }

  if ((input.type === 'series' || input.type === 'season') && !input.metadata?.seriesName) {
    return fail('INVALID_SERIES_METADATA', 'Invalid series metadata: seriesName is required for series and season playlists', 400);
  }

  if (input.type === 'season' && (!input.metadata?.seasonNumber || input.metadata.seasonNumber < 1)) {
    return fail('INVALID_SERIES_METADATA', 'Invalid series metadata: seasonNumber must be a positive integer for season playlists', 400);
  }

  return null;
}

function validateUpdateRequest(input: UpdatePlaylistRequest) {
  const hasUpdates = input.name !== undefined ||
    input.description !== undefined ||
    input.isPublic !== undefined ||
    input.metadata !== undefined;

  if (!hasUpdates) {
    return fail('VALIDATION_ERROR', 'At least one field must be provided for update', 400);
  }

  if (input.name !== undefined && !input.name.trim()) {
    return fail('INVALID_PLAYLIST_DATA', 'Invalid playlist name: cannot be empty', 400);
  }

  if (input.name && input.name.trim().length > 255) {
    return fail('INVALID_PLAYLIST_DATA', 'Invalid playlist name: cannot exceed 255 characters', 400);
  }

  if (input.description && input.description.trim().length > 1000) {
    return fail('INVALID_PLAYLIST_DATA', 'Invalid playlist description: cannot exceed 1000 characters', 400);
  }

  return null;
}

let cachedPlaylistOwnerAdapter: CompatibilityPlaylistOwnerAdapter | null = null;

function getPlaylistOwnerAdapter() {
  if (!cachedPlaylistOwnerAdapter) {
    cachedPlaylistOwnerAdapter = new CompatibilityPlaylistOwnerAdapter();
  }

  return cachedPlaylistOwnerAdapter;
}

export async function resolveServerPlaylistOwnerId() {
  const owner = await getPlaylistOwnerAdapter().resolveOwner();
  return owner.id;
}

export function createServerPlaylistServices() {
  const playlistRepository = new JsonPlaylistRepository();
  const videoCatalog = new SqlitePlaylistVideoCatalog();
  const ownerAdapter = getPlaylistOwnerAdapter();

  return {
    addVideoToPlaylist: {
      execute: async (input: {
        episodeMetadata?: Record<string, unknown>;
        ownerId?: string;
        playlistId: string;
        position?: number;
        videoId: string;
      }): Promise<PlaylistResult<{
        finalPosition: number;
        message: string;
        playlistName: string;
        success: true;
        totalVideosInPlaylist: number;
        videoTitle: string;
      }>> => {
        const ownerId = input.ownerId ?? (await ownerAdapter.resolveOwner()).id;
        const playlist = await playlistRepository.findById(input.playlistId);

        if (!playlist) {
          return fail('PLAYLIST_NOT_FOUND', `Playlist with ID "${input.playlistId}" not found`, 404);
        }

        if (playlist.ownerId !== ownerId) {
          return fail('PLAYLIST_PERMISSION_DENIED', `User "${ownerId}" does not have permission to add video to playlist "${input.playlistId}"`, 403);
        }

        if (playlist.videoIds.includes(input.videoId)) {
          return fail('DUPLICATE_VIDEO_IN_PLAYLIST', `Video "${input.videoId}" is already in playlist "${input.playlistId}"`, 409);
        }

        const video = await videoCatalog.findById(input.videoId);
        if (!video) {
          return fail('VIDEO_NOT_FOUND', `Video with ID "${input.videoId}" not found`, 400);
        }

        const position = input.position ?? playlist.videoIds.length;
        if (position < 0 || position > playlist.videoIds.length) {
          return fail('INVALID_PLAYLIST_POSITION', `Invalid position ${position}. Must be between 0 and ${playlist.videoIds.length}`, 400);
        }

        await playlistRepository.addVideoToPlaylist(
          input.playlistId,
          input.videoId,
          position,
          input.episodeMetadata,
        );
        const updated = await playlistRepository.findById(input.playlistId);

        return ok({
          finalPosition: position,
          message: `Video "${video.title}" added to playlist "${playlist.name}" successfully`,
          playlistName: playlist.name,
          success: true as const,
          totalVideosInPlaylist: updated?.videoIds.length ?? playlist.videoIds.length + 1,
          videoTitle: video.title,
        });
      },
    },
    createPlaylist: {
      execute: async (input: CreatePlaylistRequest & { ownerId?: string }): Promise<PlaylistResult<{
        autoGeneratedThumbnail: false;
        message: string;
        playlistId: string;
        suggestedMetadata?: Partial<PlaylistMetadata>;
      }>> => {
        const validationFailure = validateCreateRequest(input);
        if (validationFailure) {
          return validationFailure;
        }

        const ownerId = input.ownerId ?? (await ownerAdapter.resolveOwner()).id;
        const nameExists = await playlistRepository.nameExistsForOwner(input.name, ownerId);

        if (nameExists) {
          return fail('DUPLICATE_PLAYLIST_NAME', `Playlist with name "${input.name}" already exists for user "${ownerId}"`, 409);
        }

        const playlist = await playlistRepository.create({
          description: input.description?.trim() || undefined,
          isPublic: input.isPublic ?? false,
          metadata: input.metadata,
          name: input.name.trim(),
          ownerId,
          type: input.type,
          videoIds: input.initialVideoIds ?? [],
        });

        return ok({
          autoGeneratedThumbnail: false as const,
          message: `Playlist "${playlist.name}" created successfully`,
          playlistId: playlist.id,
          suggestedMetadata: getSuggestedMetadata(input),
        });
      },
    },
    deletePlaylist: {
      execute: async (input: {
        force?: boolean;
        ownerId?: string;
        playlistId: string;
      }): Promise<PlaylistResult<{
        deletedPlaylistName: string;
        message: string;
        relatedPlaylistsAffected: string[];
        success: true;
        videosAffected: number;
      }>> => {
        const ownerId = input.ownerId ?? (await ownerAdapter.resolveOwner()).id;
        const playlist = await playlistRepository.findById(input.playlistId);

        if (!playlist) {
          return fail('PLAYLIST_NOT_FOUND', `Playlist with ID "${input.playlistId}" not found`, 404);
        }

        if (playlist.ownerId !== ownerId) {
          return fail('PLAYLIST_PERMISSION_DENIED', `User "${ownerId}" does not have permission to delete playlist "${input.playlistId}"`, 403);
        }

        const related = playlist.type === 'series' && playlist.metadata?.seriesName
          ? await playlistRepository.findBySeries(playlist.metadata.seriesName)
          : [];

        await playlistRepository.delete(playlist.id);

        return ok({
          deletedPlaylistName: playlist.name,
          message: `Playlist "${playlist.name}" deleted successfully`,
          relatedPlaylistsAffected: related.filter(candidate => candidate.id !== playlist.id).map(candidate => candidate.id),
          success: true as const,
          videosAffected: playlist.videoIds.length,
        });
      },
    },
    findPlaylists: {
      execute: async (input: FindPlaylistsInput): Promise<PlaylistResult<{
        filters: PlaylistFilters;
        hasMore: boolean;
        pagination: {
          currentPage: number;
          limit: number;
          offset: number;
          totalPages: number;
        };
        playlists: Playlist[];
        stats?: PlaylistStats[];
        totalCount: number;
      }>> => {
        if (input.limit < 1 || input.limit > 100) {
          return fail('VALIDATION_ERROR', 'Limit must be between 1 and 100', 400);
        }

        if (input.offset < 0) {
          return fail('VALIDATION_ERROR', 'Offset must be non-negative', 400);
        }

        const effectiveFilters = { ...input.filters };
        if (!input.ownerId) {
          effectiveFilters.isPublic = true;
        }

        const allPlaylists = await playlistRepository.findWithFilters(effectiveFilters);
        const accessible = allPlaylists.filter((playlist) => {
          if (playlist.isPublic) {
            return true;
          }

          return playlist.ownerId === input.ownerId;
        });
        const filtered = input.includeEmpty ? accessible : accessible.filter(playlist => playlist.videoIds.length > 0);
        const sorted = sortPlaylists(filtered, input.sortBy, input.sortOrder);
        const totalCount = sorted.length;
        const paginated = sorted.slice(input.offset, input.offset + input.limit);

        return ok({
          filters: effectiveFilters,
          hasMore: input.offset + input.limit < totalCount,
          pagination: {
            currentPage: Math.floor(input.offset / input.limit) + 1,
            limit: input.limit,
            offset: input.offset,
            totalPages: Math.ceil(totalCount / input.limit),
          },
          playlists: paginated,
          stats: input.includeStats ? paginated.map(calculateStats) : undefined,
          totalCount,
        });
      },
    },
    getPlaylistDetails: {
      execute: async (input: GetPlaylistDetailsInput): Promise<PlaylistResult<{
        permissions: {
          canAddVideos: boolean;
          canDelete: boolean;
          canEdit: boolean;
          canShare: boolean;
        };
        playlist: PlaylistWithVideos;
        relatedPlaylists?: Array<{
          id: string;
          name: string;
          relationship: 'child' | 'parent' | 'sibling';
          type: string;
          videoCount: number;
        }>;
        stats?: PlaylistStats;
        videoPagination: {
          hasMore: boolean;
          limit: number;
          offset: number;
          total: number;
        } | null;
      }>> => {
        if (!input.playlistId.trim()) {
          return fail('VALIDATION_ERROR', 'Playlist ID cannot be empty', 400);
        }

        const playlist = await playlistRepository.findById(input.playlistId);
        if (!playlist) {
          return fail('PLAYLIST_NOT_FOUND', `Playlist with ID "${input.playlistId}" not found`, 404);
        }

        if (!checkPlaylistAccess(playlist, input.ownerId)) {
          return fail('PLAYLIST_PERMISSION_DENIED', `User "${input.ownerId ?? 'anonymous'}" does not have permission to view playlist "${input.playlistId}"`, 403);
        }

        const playlistItems = input.includeVideos
          ? await playlistRepository.getPlaylistItems(playlist.id)
          : [];
        const allVideos = input.includeVideos ? await videoCatalog.getPlaylistVideos(playlistItems) : [];
        const paginatedVideos = input.includeVideos
          ? allVideos.slice(input.videoOffset, input.videoOffset + input.videoLimit)
          : [];

        const relatedPlaylists = input.includeRelated && playlist.metadata?.seriesName
          ? (await playlistRepository.findBySeries(playlist.metadata.seriesName))
              .filter(candidate => checkPlaylistAccess(candidate, input.ownerId))
              .filter(candidate => candidate.id !== playlist.id)
              .map(candidate => ({
                id: candidate.id,
                name: candidate.name,
                relationship: candidate.type === 'series' ? 'parent' as const : 'sibling' as const,
                type: candidate.type,
                videoCount: candidate.videoIds.length,
              }))
          : undefined;

        return ok({
          permissions: calculatePermissions(playlist, input.ownerId),
          playlist: {
            ...playlist,
            stats: input.includeStats ? calculateStats(playlist) : undefined,
            videos: paginatedVideos,
          },
          relatedPlaylists,
          stats: input.includeStats ? calculateStats(playlist) : undefined,
          videoPagination: input.includeVideos
            ? {
                hasMore: input.videoOffset + input.videoLimit < playlist.videoIds.length,
                limit: input.videoLimit,
                offset: input.videoOffset,
                total: playlist.videoIds.length,
              }
            : null,
        });
      },
    },
    removeVideoFromPlaylist: {
      execute: async (input: {
        ownerId?: string;
        playlistId: string;
        videoId: string;
      }): Promise<PlaylistResult<{
        message: string;
        playlistId: string;
        remainingVideos: number;
        success: true;
        videoId: string;
      }>> => {
        const ownerId = input.ownerId ?? (await ownerAdapter.resolveOwner()).id;
        const playlist = await playlistRepository.findById(input.playlistId);

        if (!playlist) {
          return fail('PLAYLIST_NOT_FOUND', `Playlist with ID "${input.playlistId}" not found`, 404);
        }

        if (playlist.ownerId !== ownerId) {
          return fail('PLAYLIST_PERMISSION_DENIED', `User "${ownerId}" does not have permission to modify playlist "${input.playlistId}"`, 403);
        }

        if (!playlist.videoIds.includes(input.videoId)) {
          return fail('VIDEO_NOT_FOUND_IN_PLAYLIST', `Video "${input.videoId}" not found in playlist "${input.playlistId}"`, 404);
        }

        await playlistRepository.removeVideoFromPlaylist(input.playlistId, input.videoId);
        const updated = await playlistRepository.findById(input.playlistId);

        return ok({
          message: `Video removed from playlist "${playlist.name}" successfully`,
          playlistId: input.playlistId,
          remainingVideos: updated?.videoIds.length ?? Math.max(playlist.videoIds.length - 1, 0),
          success: true as const,
          videoId: input.videoId,
        });
      },
    },
    reorderPlaylistItems: {
      execute: async (input: {
        newOrder: string[];
        ownerId?: string;
        preserveMetadata?: boolean;
        playlistId: string;
      }): Promise<PlaylistResult<{
        message: string;
        newOrder: string[];
        oldOrder: string[];
        playlistName: string;
        success: true;
        videosReordered: number;
      }>> => {
        const ownerId = input.ownerId ?? (await ownerAdapter.resolveOwner()).id;
        const playlist = await playlistRepository.findById(input.playlistId);

        if (!playlist) {
          return fail('PLAYLIST_NOT_FOUND', `Playlist with ID "${input.playlistId}" not found`, 404);
        }

        if (playlist.ownerId !== ownerId) {
          return fail('PLAYLIST_PERMISSION_DENIED', `User "${ownerId}" does not have permission to reorder playlist "${input.playlistId}"`, 403);
        }

        if (!Array.isArray(input.newOrder) || input.newOrder.length === 0) {
          return fail('VALIDATION_ERROR', 'New order cannot be empty', 400);
        }

        const currentSet = new Set(playlist.videoIds);
        const nextSet = new Set(input.newOrder);
        if (currentSet.size !== nextSet.size || [...currentSet].some(videoId => !nextSet.has(videoId))) {
          return fail('PLAYLIST_REORDER_ERROR', 'New order must contain exactly the same videos as current playlist', 400);
        }

        const oldOrder = [...playlist.videoIds];
        await playlistRepository.reorderPlaylistItems(input.playlistId, input.newOrder);

        return ok({
          message: `Playlist "${playlist.name}" reordered successfully`,
          newOrder: [...input.newOrder],
          oldOrder,
          playlistName: playlist.name,
          success: true as const,
          videosReordered: input.newOrder.length,
        });
      },
    },
    updatePlaylist: {
      execute: async (input: UpdatePlaylistRequest & {
        ownerId?: string;
        playlistId: string;
      }): Promise<PlaylistResult<{
        fieldsUpdated: string[];
        message: string;
        playlist: Playlist;
      }>> => {
        const validationFailure = validateUpdateRequest(input);
        if (validationFailure) {
          return validationFailure;
        }

        const ownerId = input.ownerId ?? (await ownerAdapter.resolveOwner()).id;
        const playlist = await playlistRepository.findById(input.playlistId);

        if (!playlist) {
          return fail('PLAYLIST_NOT_FOUND', `Playlist with ID "${input.playlistId}" not found`, 404);
        }

        if (playlist.ownerId !== ownerId) {
          return fail('PLAYLIST_PERMISSION_DENIED', `User "${ownerId}" does not have permission to update playlist "${input.playlistId}"`, 403);
        }

        if (input.name && input.name !== playlist.name) {
          const nameExists = await playlistRepository.nameExistsForOwner(input.name, ownerId, playlist.id);
          if (nameExists) {
            return fail('DUPLICATE_PLAYLIST_NAME', `Playlist with name "${input.name}" already exists for user "${ownerId}"`, 409);
          }
        }

        const fieldsUpdated: string[] = [];
        const updates: UpdatePlaylistRequest = {};

        if (input.name !== undefined && input.name !== playlist.name) {
          updates.name = input.name.trim();
          fieldsUpdated.push('name');
        }
        if (input.description !== undefined && input.description !== playlist.description) {
          updates.description = input.description?.trim() || undefined;
          fieldsUpdated.push('description');
        }
        if (input.isPublic !== undefined && input.isPublic !== playlist.isPublic) {
          updates.isPublic = input.isPublic;
          fieldsUpdated.push('isPublic');
        }
        if (input.metadata !== undefined) {
          updates.metadata = {
            ...playlist.metadata,
            ...input.metadata,
          };
          fieldsUpdated.push('metadata');
        }

        if (fieldsUpdated.length === 0) {
          return ok({
            fieldsUpdated,
            message: 'No changes were made to the playlist',
            playlist,
          });
        }

        const updated = await playlistRepository.update(input.playlistId, updates);
        if (!updated) {
          return fail('INTERNAL_ERROR', 'Failed to update playlist', 500);
        }

        return ok({
          fieldsUpdated,
          message: `Playlist "${updated.name}" updated successfully`,
          playlist: updated,
        });
      },
    },
  };
}

let cachedPlaylistServices: ReturnType<typeof createServerPlaylistServices> | null = null;

export function getServerPlaylistServices() {
  if (!cachedPlaylistServices) {
    cachedPlaylistServices = createServerPlaylistServices();
  }

  return cachedPlaylistServices;
}
