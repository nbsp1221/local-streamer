import type { PlaylistRepositoryPort } from '../ports/playlist-repository.port';

export interface ReorderPlaylistItemsInput {
  newOrder: string[];
  ownerId: string;
  playlistId: string;
  preserveMetadata?: boolean;
}

export interface ReorderPlaylistItemsOutput {
  message: string;
  newOrder: string[];
  oldOrder: string[];
  playlistName: string;
  videosReordered: number;
}

export type ReorderPlaylistItemsUseCaseResult =
  | {
    ok: true;
    data: ReorderPlaylistItemsOutput;
  }
  | {
    ok: false;
    message: string;
    reason:
      | 'PLAYLIST_MUTATION_FAILED'
      | 'PLAYLIST_NOT_FOUND'
      | 'PLAYLIST_PERMISSION_DENIED'
      | 'PLAYLIST_REORDER_ERROR'
      | 'VALIDATION_ERROR';
  };

interface ReorderPlaylistItemsUseCaseDependencies {
  playlistRepository: Pick<PlaylistRepositoryPort, 'findById' | 'reorderPlaylistItems'>;
}

export class ReorderPlaylistItemsUseCase {
  constructor(
    private readonly deps: ReorderPlaylistItemsUseCaseDependencies,
  ) {}

  async execute(input: ReorderPlaylistItemsInput): Promise<ReorderPlaylistItemsUseCaseResult> {
    try {
      const playlist = await this.deps.playlistRepository.findById(input.playlistId);

      if (!playlist) {
        return {
          message: `Playlist with ID "${input.playlistId}" not found`,
          ok: false,
          reason: 'PLAYLIST_NOT_FOUND',
        };
      }

      if (playlist.ownerId !== input.ownerId) {
        return {
          message: `User "${input.ownerId}" does not have permission to reorder playlist "${input.playlistId}"`,
          ok: false,
          reason: 'PLAYLIST_PERMISSION_DENIED',
        };
      }

      if (!Array.isArray(input.newOrder) || input.newOrder.length === 0) {
        return {
          message: 'New order cannot be empty',
          ok: false,
          reason: 'VALIDATION_ERROR',
        };
      }

      const currentSet = new Set(playlist.videoIds);
      const nextSet = new Set(input.newOrder);
      if (currentSet.size !== nextSet.size || [...currentSet].some(videoId => !nextSet.has(videoId))) {
        return {
          message: 'New order must contain exactly the same videos as current playlist',
          ok: false,
          reason: 'PLAYLIST_REORDER_ERROR',
        };
      }

      const oldOrder = [...playlist.videoIds];
      await this.deps.playlistRepository.reorderPlaylistItems(input.playlistId, input.newOrder);

      return {
        ok: true,
        data: {
          message: `Playlist "${playlist.name}" reordered successfully`,
          newOrder: [...input.newOrder],
          oldOrder,
          playlistName: playlist.name,
          videosReordered: input.newOrder.length,
        },
      };
    }
    catch {
      return {
        message: 'Failed to reorder playlist',
        ok: false,
        reason: 'PLAYLIST_MUTATION_FAILED',
      };
    }
  }
}
