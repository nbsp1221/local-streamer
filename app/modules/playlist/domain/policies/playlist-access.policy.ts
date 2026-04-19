import type { Playlist } from '../playlist';

export interface PlaylistPermissions {
  canAddVideos: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canShare: boolean;
}

export class PlaylistAccessPolicy {
  static canAccess(input: {
    ownerId?: string;
    playlist: Playlist;
  }): boolean {
    if (input.playlist.isPublic) {
      return true;
    }

    if (!input.ownerId) {
      return false;
    }

    return input.playlist.ownerId === input.ownerId;
  }

  static describePermissions(input: {
    ownerId?: string;
    playlist: Playlist;
  }): PlaylistPermissions {
    const isOwner = input.playlist.ownerId === input.ownerId;

    return {
      canAddVideos: isOwner,
      canDelete: isOwner,
      canEdit: isOwner,
      canShare: input.playlist.isPublic || isOwner,
    };
  }
}
