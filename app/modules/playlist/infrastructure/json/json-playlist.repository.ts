import { randomUUID } from 'node:crypto';
import type {
  Playlist,
  PlaylistFilters,
  PlaylistItem,
  PlaylistMetadata,
  PlaylistType,
  UpdatePlaylistRequest,
} from '~/modules/playlist/domain/playlist';
import { jsonWriteQueue } from './json-write-queue';
import { getPlaylistStoragePaths } from './playlist-storage-paths.server';

type PlaylistRow = Omit<Playlist, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type PlaylistItemRow = Omit<PlaylistItem, 'addedAt'> & {
  addedAt: string;
};

interface CreatePlaylistInput {
  description?: string;
  isPublic: boolean;
  metadata?: PlaylistMetadata;
  name: string;
  ownerId: string;
  thumbnailUrl?: string;
  type: PlaylistType;
  videoIds?: string[];
}

export class JsonPlaylistRepository {
  private readonly filePath = getPlaylistStoragePaths().playlistsJson;
  private readonly playlistItemsFilePath = getPlaylistStoragePaths().playlistItemsJson;

  private toDomain(row: PlaylistRow): Playlist {
    return {
      ...row,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
      videoIds: Array.isArray(row.videoIds) ? row.videoIds : [],
    };
  }

  private toRow(playlist: Playlist): PlaylistRow {
    return {
      ...playlist,
      createdAt: playlist.createdAt.toISOString(),
      updatedAt: playlist.updatedAt.toISOString(),
    };
  }

  private toPlaylistItem(row: PlaylistItemRow): PlaylistItem {
    return {
      ...row,
      addedAt: new Date(row.addedAt),
    };
  }

  private toPlaylistItemRow(item: PlaylistItem): PlaylistItemRow {
    return {
      ...item,
      addedAt: item.addedAt.toISOString(),
    };
  }

  private async readAllPlaylistItems(): Promise<PlaylistItem[]> {
    await jsonWriteQueue.ensureFile(this.playlistItemsFilePath, []);
    const rows = await jsonWriteQueue.readJson<PlaylistItemRow[]>(this.playlistItemsFilePath, []);
    return rows.map(row => this.toPlaylistItem(row));
  }

  private async writeAllPlaylistItems(items: PlaylistItem[]) {
    await jsonWriteQueue.writeJson(
      this.playlistItemsFilePath,
      items.map(item => this.toPlaylistItemRow(item)),
    );
  }

  private buildProjectedItems(
    playlist: Playlist,
    existingItems: PlaylistItem[],
    overrides: Map<string, Partial<PlaylistItem>> = new Map(),
  ) {
    const existingByVideoId = new Map(existingItems.map(item => [item.videoId, item]));

    return playlist.videoIds.map((videoId, index) => {
      const existingItem = existingByVideoId.get(videoId);
      const override = overrides.get(videoId);

      return {
        addedAt: override?.addedAt ?? existingItem?.addedAt ?? playlist.updatedAt,
        addedBy: override?.addedBy ?? existingItem?.addedBy ?? playlist.ownerId,
        episodeMetadata: override?.episodeMetadata ?? existingItem?.episodeMetadata,
        playlistId: playlist.id,
        position: index + 1,
        videoId,
      } satisfies PlaylistItem;
    });
  }

  private async syncPlaylistItems(
    playlist: Playlist,
    overrides: Map<string, Partial<PlaylistItem>> = new Map(),
  ) {
    const allItems = await this.readAllPlaylistItems();
    const unrelatedItems = allItems.filter(item => item.playlistId !== playlist.id);
    const existingItems = allItems.filter(item => item.playlistId === playlist.id);
    const projectedItems = this.buildProjectedItems(playlist, existingItems, overrides);

    await this.writeAllPlaylistItems([...unrelatedItems, ...projectedItems]);
  }

  private async readAll(): Promise<Playlist[]> {
    await jsonWriteQueue.ensureFile(this.filePath, []);
    const rows = await jsonWriteQueue.readJson<PlaylistRow[]>(this.filePath, []);
    return rows.map(row => this.toDomain(row));
  }

  private async writeAll(playlists: Playlist[]) {
    await jsonWriteQueue.writeJson(this.filePath, playlists.map(playlist => this.toRow(playlist)));
  }

  async findAll() {
    return this.readAll();
  }

  async findById(id: string) {
    const playlists = await this.readAll();
    return playlists.find(playlist => playlist.id === id) ?? null;
  }

  async findWithFilters(filters: PlaylistFilters) {
    const playlists = await this.readAll();

    return playlists.filter((playlist) => {
      if (filters.type && playlist.type !== filters.type) {
        return false;
      }

      if (filters.ownerId && playlist.ownerId !== filters.ownerId) {
        return false;
      }

      if (filters.isPublic !== undefined && playlist.isPublic !== filters.isPublic) {
        return false;
      }

      if (filters.genre?.length) {
        const genres = playlist.metadata?.genre ?? [];
        if (!genres.some(genre => filters.genre!.includes(genre))) {
          return false;
        }
      }

      if (filters.seriesName && playlist.metadata?.seriesName !== filters.seriesName) {
        return false;
      }

      if (filters.status && playlist.metadata?.status !== filters.status) {
        return false;
      }

      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matches = [
          playlist.name,
          playlist.description ?? '',
          ...(playlist.metadata?.genre ?? []),
        ].some(value => value.toLowerCase().includes(query));

        if (!matches) {
          return false;
        }
      }

      return true;
    });
  }

  async findBySeries(seriesName: string) {
    const playlists = await this.readAll();
    return playlists.filter(playlist => playlist.metadata?.seriesName?.toLowerCase() === seriesName.toLowerCase());
  }

  async nameExistsForOwner(name: string, ownerId: string, excludeId?: string) {
    const playlists = await this.readAll();
    return playlists.some(playlist => playlist.ownerId === ownerId &&
      playlist.name.toLowerCase() === name.toLowerCase() &&
      playlist.id !== excludeId);
  }

  async create(input: CreatePlaylistInput) {
    const playlists = await this.readAll();
    const now = new Date();
    const playlist: Playlist = {
      createdAt: now,
      description: input.description,
      id: randomUUID(),
      isPublic: input.isPublic,
      metadata: input.metadata,
      name: input.name,
      ownerId: input.ownerId,
      thumbnailUrl: input.thumbnailUrl,
      type: input.type,
      updatedAt: now,
      videoIds: input.videoIds ?? [],
    };
    playlists.unshift(playlist);
    await this.writeAll(playlists);
    await this.syncPlaylistItems(playlist);
    return playlist;
  }

  async update(id: string, updates: UpdatePlaylistRequest & { metadata?: PlaylistMetadata; videoIds?: string[] }) {
    const playlists = await this.readAll();
    const index = playlists.findIndex(playlist => playlist.id === id);

    if (index === -1) {
      return null;
    }

    const existing = playlists[index];
    const updated: Playlist = {
      ...existing,
      ...updates,
      id: existing.id,
      updatedAt: new Date(),
    };

    playlists[index] = updated;
    await this.writeAll(playlists);
    return updated;
  }

  async delete(id: string) {
    const playlists = await this.readAll();
    const next = playlists.filter(playlist => playlist.id !== id);

    if (next.length === playlists.length) {
      return false;
    }

    const playlistItems = await this.readAllPlaylistItems();
    await this.writeAll(next);
    await this.writeAllPlaylistItems(playlistItems.filter(item => item.playlistId !== id));
    return true;
  }

  async addVideoToPlaylist(
    playlistId: string,
    videoId: string,
    position?: number,
    episodeMetadata?: PlaylistItem['episodeMetadata'],
  ) {
    const playlist = await this.findById(playlistId);

    if (!playlist) {
      throw new Error(`Playlist with ID "${playlistId}" not found`);
    }

    if (playlist.videoIds.includes(videoId)) {
      throw new Error(`Video "${videoId}" is already in playlist "${playlistId}"`);
    }

    const nextIds = [...playlist.videoIds];

    if (position !== undefined && position >= 0 && position <= nextIds.length) {
      nextIds.splice(position, 0, videoId);
    }
    else {
      nextIds.push(videoId);
    }

    const updatedPlaylist = await this.update(playlistId, { videoIds: nextIds });

    if (!updatedPlaylist) {
      throw new Error(`Playlist with ID "${playlistId}" not found`);
    }

    const overrides = new Map<string, Partial<PlaylistItem>>();
    overrides.set(videoId, {
      addedAt: new Date(),
      addedBy: updatedPlaylist.ownerId,
      episodeMetadata,
    });
    await this.syncPlaylistItems(updatedPlaylist, overrides);
  }

  async removeVideoFromPlaylist(playlistId: string, videoId: string) {
    const playlist = await this.findById(playlistId);

    if (!playlist) {
      throw new Error(`Playlist with ID "${playlistId}" not found`);
    }

    if (!playlist.videoIds.includes(videoId)) {
      throw new Error(`Video "${videoId}" not found in playlist "${playlistId}"`);
    }

    const updatedPlaylist = await this.update(playlistId, { videoIds: playlist.videoIds.filter(id => id !== videoId) });

    if (!updatedPlaylist) {
      throw new Error(`Playlist with ID "${playlistId}" not found`);
    }

    await this.syncPlaylistItems(updatedPlaylist);
  }

  async reorderPlaylistItems(playlistId: string, newOrder: string[]) {
    const playlist = await this.findById(playlistId);

    if (!playlist) {
      throw new Error(`Playlist with ID "${playlistId}" not found`);
    }

    const currentSet = new Set(playlist.videoIds);
    const nextSet = new Set(newOrder);

    if (currentSet.size !== nextSet.size || [...currentSet].some(videoId => !nextSet.has(videoId))) {
      throw new Error('New order must contain exactly the same videos as current playlist');
    }

    const updatedPlaylist = await this.update(playlistId, { videoIds: [...newOrder] });

    if (!updatedPlaylist) {
      throw new Error(`Playlist with ID "${playlistId}" not found`);
    }

    await this.syncPlaylistItems(updatedPlaylist);
  }

  async getPlaylistItems(playlistId: string) {
    const playlist = await this.findById(playlistId);

    if (!playlist) {
      return [];
    }

    const allItems = await this.readAllPlaylistItems();
    const existingItems = allItems.filter(item => item.playlistId === playlistId);

    return this.buildProjectedItems(playlist, existingItems);
  }
}
