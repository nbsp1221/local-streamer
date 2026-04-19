import type {
  Playlist,
  PlaylistFilters,
  PlaylistItem,
  PlaylistMetadata,
  PlaylistType,
  UpdatePlaylistRequest,
} from '../../domain/playlist';

export interface CreatePlaylistPortInput {
  description?: string;
  isPublic: boolean;
  metadata?: PlaylistMetadata;
  name: string;
  ownerId: string;
  thumbnailUrl?: string;
  type: PlaylistType;
  videoIds?: string[];
}

export interface UpdatePlaylistPortInput extends UpdatePlaylistRequest {
  metadata?: PlaylistMetadata;
  videoIds?: string[];
}

export interface PlaylistRepositoryPort {
  addVideoToPlaylist(
    playlistId: string,
    videoId: string,
    position?: number,
    episodeMetadata?: PlaylistItem['episodeMetadata'],
  ): Promise<void>;
  create(input: CreatePlaylistPortInput): Promise<Playlist>;
  delete(id: string): Promise<boolean>;
  findById(id: string): Promise<Playlist | null>;
  findBySeries(seriesName: string): Promise<Playlist[]>;
  findWithFilters(filters: PlaylistFilters): Promise<Playlist[]>;
  getPlaylistItems(playlistId: string): Promise<PlaylistItem[]>;
  nameExistsForOwner(name: string, ownerId: string, excludeId?: string): Promise<boolean>;
  removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void>;
  reorderPlaylistItems(playlistId: string, newOrder: string[]): Promise<void>;
  update(id: string, updates: UpdatePlaylistPortInput): Promise<Playlist | null>;
}
