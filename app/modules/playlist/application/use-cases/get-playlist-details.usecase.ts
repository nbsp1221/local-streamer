import type { PlaylistStats, PlaylistWithVideos } from '../../domain/playlist';
import type { PlaylistPermissions } from '../../domain/policies/playlist-access.policy';
import type { PlaylistRepositoryPort } from '../ports/playlist-repository.port';
import type { PlaylistVideoCatalogPort } from '../ports/playlist-video-catalog.port';
import { PlaylistAccessPolicy } from '../../domain/policies/playlist-access.policy';
import { PlaylistStatsPolicy } from '../../domain/policies/playlist-stats.policy';

export interface GetPlaylistDetailsInput {
  includeRelated: boolean;
  includeStats: boolean;
  includeVideos: boolean;
  ownerId?: string;
  playlistId: string;
  videoLimit: number;
  videoOffset: number;
}

export interface PlaylistRelationship {
  id: string;
  name: string;
  relationship: 'child' | 'parent' | 'sibling';
  type: string;
  videoCount: number;
}

export interface GetPlaylistDetailsOutput {
  permissions: PlaylistPermissions;
  playlist: PlaylistWithVideos;
  relatedPlaylists?: PlaylistRelationship[];
  stats?: PlaylistStats;
  videoPagination: {
    hasMore: boolean;
    limit: number;
    offset: number;
    total: number;
  } | null;
}

export type GetPlaylistDetailsUseCaseResult =
  | {
    ok: true;
    data: GetPlaylistDetailsOutput;
  }
  | {
    ok: false;
    message: string;
    reason:
      | 'PLAYLIST_NOT_FOUND'
      | 'PLAYLIST_PERMISSION_DENIED'
      | 'PLAYLIST_QUERY_UNAVAILABLE'
      | 'VALIDATION_ERROR';
  };

interface GetPlaylistDetailsUseCaseDependencies {
  playlistRepository: Pick<PlaylistRepositoryPort, 'findById' | 'findBySeries' | 'getPlaylistItems'>;
  videoCatalog: PlaylistVideoCatalogPort;
}

function isIntegerInRange(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum;
}

function isNonNegativeInteger(value: number) {
  return Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0;
}

export class GetPlaylistDetailsUseCase {
  constructor(
    private readonly deps: GetPlaylistDetailsUseCaseDependencies,
  ) {}

  async execute(input: GetPlaylistDetailsInput): Promise<GetPlaylistDetailsUseCaseResult> {
    if (!input.playlistId.trim()) {
      return {
        message: 'Playlist ID cannot be empty',
        ok: false,
        reason: 'VALIDATION_ERROR',
      };
    }

    if (!isIntegerInRange(input.videoLimit, 1, 100)) {
      return {
        message: 'Video limit must be an integer between 1 and 100',
        ok: false,
        reason: 'VALIDATION_ERROR',
      };
    }

    if (!isNonNegativeInteger(input.videoOffset)) {
      return {
        message: 'Video offset must be a non-negative integer',
        ok: false,
        reason: 'VALIDATION_ERROR',
      };
    }

    try {
      const playlist = await this.deps.playlistRepository.findById(input.playlistId);

      if (!playlist) {
        return {
          message: `Playlist with ID "${input.playlistId}" not found`,
          ok: false,
          reason: 'PLAYLIST_NOT_FOUND',
        };
      }

      if (!PlaylistAccessPolicy.canAccess({
        ownerId: input.ownerId,
        playlist,
      })) {
        return {
          message: `User "${input.ownerId ?? 'anonymous'}" does not have permission to view playlist "${input.playlistId}"`,
          ok: false,
          reason: 'PLAYLIST_PERMISSION_DENIED',
        };
      }

      const playlistItems = input.includeVideos
        ? await this.deps.playlistRepository.getPlaylistItems(playlist.id)
        : [];
      const resolvedVideos = input.includeVideos
        ? await this.deps.videoCatalog.getPlaylistVideos(playlistItems)
        : [];
      const videos = input.includeVideos
        ? resolvedVideos.slice(input.videoOffset, input.videoOffset + input.videoLimit)
        : [];
      const stats = input.includeStats
        ? PlaylistStatsPolicy.build(playlist)
        : undefined;
      const relatedPlaylists = input.includeRelated && playlist.metadata?.seriesName
        ? (await this.deps.playlistRepository.findBySeries(playlist.metadata.seriesName))
            .filter(candidate => candidate.id !== playlist.id)
            .filter(candidate => PlaylistAccessPolicy.canAccess({
              ownerId: input.ownerId,
              playlist: candidate,
            }))
            .map(candidate => ({
              id: candidate.id,
              name: candidate.name,
              relationship: candidate.type === 'series'
                ? 'parent' as const
                : 'sibling' as const,
              type: candidate.type,
              videoCount: candidate.videoIds.length,
            }))
        : undefined;

      return {
        ok: true,
        data: {
          permissions: PlaylistAccessPolicy.describePermissions({
            ownerId: input.ownerId,
            playlist,
          }),
          playlist: {
            ...playlist,
            stats,
            videos,
          },
          relatedPlaylists,
          stats,
          videoPagination: input.includeVideos
            ? {
                hasMore: input.videoOffset + input.videoLimit < playlist.videoIds.length,
                limit: input.videoLimit,
                offset: input.videoOffset,
                total: playlist.videoIds.length,
              }
            : null,
        },
      };
    }
    catch {
      return {
        message: 'Failed to load playlist details',
        ok: false,
        reason: 'PLAYLIST_QUERY_UNAVAILABLE',
      };
    }
  }
}
