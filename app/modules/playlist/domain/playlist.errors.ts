/**
 * Playlist Domain Errors
 *
 * This module defines playlist-specific domain errors extending the base DomainError hierarchy.
 */

import { DomainError } from '~/lib/errors';

// Base abstract class for all playlist-related errors
export abstract class PlaylistError extends DomainError {}

/**
 * Thrown when a playlist is not found by ID
 */
export class PlaylistNotFoundError extends PlaylistError {
  constructor(playlistId: string) {
    super(`Playlist with ID "${playlistId}" not found`, 'PLAYLIST_NOT_FOUND', 404);
    this.name = 'PlaylistNotFoundError';
  }
}

/**
 * Thrown when trying to add a video that doesn't exist to a playlist
 */
export class VideoNotFoundInPlaylistError extends PlaylistError {
  constructor(videoId: string, playlistId: string) {
    super(`Video "${videoId}" not found in playlist "${playlistId}"`, 'VIDEO_NOT_FOUND_IN_PLAYLIST', 404);
    this.name = 'VideoNotFoundInPlaylistError';
  }
}

/**
 * Thrown when trying to add a video that's already in the playlist
 */
export class DuplicateVideoInPlaylistError extends PlaylistError {
  constructor(videoId: string, playlistId: string) {
    super(`Video "${videoId}" is already in playlist "${playlistId}"`, 'DUPLICATE_VIDEO_IN_PLAYLIST', 409);
    this.name = 'DuplicateVideoInPlaylistError';
  }
}

/**
 * Thrown when user doesn't have permission to access/modify a playlist
 */
export class PlaylistPermissionDeniedError extends PlaylistError {
  constructor(playlistId: string, userId: string, operation: string) {
    super(
      `User "${userId}" does not have permission to ${operation} playlist "${playlistId}"`,
      'PLAYLIST_PERMISSION_DENIED',
      403,
    );
    this.name = 'PlaylistPermissionDeniedError';
  }
}

/**
 * Thrown when playlist validation fails (e.g., invalid name, type, etc.)
 */
export class InvalidPlaylistDataError extends PlaylistError {
  constructor(field: string, reason: string) {
    super(`Invalid playlist ${field}: ${reason}`, 'INVALID_PLAYLIST_DATA', 400);
    this.name = 'InvalidPlaylistDataError';
  }
}

/**
 * Thrown when trying to create a playlist with invalid type
 */
export class InvalidPlaylistTypeError extends PlaylistError {
  constructor(type: string) {
    super(`Invalid playlist type: "${type}"`, 'INVALID_PLAYLIST_TYPE', 400);
    this.name = 'InvalidPlaylistTypeError';
  }
}

/**
 * Thrown when position parameter is invalid for playlist operations
 */
export class InvalidPlaylistPositionError extends PlaylistError {
  constructor(position: number, maxPosition: number) {
    super(
      `Invalid position ${position}. Must be between 1 and ${maxPosition}`,
      'INVALID_PLAYLIST_POSITION',
      400,
    );
    this.name = 'InvalidPlaylistPositionError';
  }
}

/**
 * Thrown when series metadata is inconsistent or invalid
 */
export class InvalidSeriesMetadataError extends PlaylistError {
  constructor(reason: string) {
    super(`Invalid series metadata: ${reason}`, 'INVALID_SERIES_METADATA', 400);
    this.name = 'InvalidSeriesMetadataError';
  }
}

/**
 * Thrown when trying to add too many items to a playlist
 */
export class PlaylistCapacityExceededError extends PlaylistError {
  constructor(currentCount: number, maxCapacity: number) {
    super(
      `Playlist capacity exceeded. Current: ${currentCount}, Maximum: ${maxCapacity}`,
      'PLAYLIST_CAPACITY_EXCEEDED',
      400,
    );
    this.name = 'PlaylistCapacityExceededError';
  }
}

/**
 * Thrown when trying to perform operations on empty playlist
 */
export class EmptyPlaylistError extends PlaylistError {
  constructor(operation: string) {
    super(`Cannot ${operation} on empty playlist`, 'EMPTY_PLAYLIST_ERROR', 400);
    this.name = 'EmptyPlaylistError';
  }
}

/**
 * Thrown when bulk operations fail partially
 */
export class BulkPlaylistOperationError extends PlaylistError {
  constructor(
    operation: string,
    successful: number,
    failed: number,
    errors: string[],
  ) {
    super(
      `Bulk ${operation} partially failed. Successful: ${successful}, Failed: ${failed}. Errors: ${errors.join(', ')}`,
      'BULK_PLAYLIST_OPERATION_ERROR',
      207, // Multi-Status
    );
    this.name = 'BulkPlaylistOperationError';
  }
}

/**
 * Thrown when playlist ordering operation fails
 */
export class PlaylistReorderError extends PlaylistError {
  constructor(reason: string) {
    super(`Playlist reorder failed: ${reason}`, 'PLAYLIST_REORDER_ERROR', 400);
    this.name = 'PlaylistReorderError';
  }
}

/**
 * Thrown when trying to create/update playlist with name that already exists for user
 */
export class DuplicatePlaylistNameError extends PlaylistError {
  constructor(name: string, userId: string) {
    super(
      `Playlist with name "${name}" already exists for user "${userId}"`,
      'DUPLICATE_PLAYLIST_NAME',
      409,
    );
    this.name = 'DuplicatePlaylistNameError';
  }
}

/**
 * Thrown when series/season hierarchy is invalid
 */
export class InvalidPlaylistHierarchyError extends PlaylistError {
  constructor(reason: string) {
    super(`Invalid playlist hierarchy: ${reason}`, 'INVALID_PLAYLIST_HIERARCHY', 400);
    this.name = 'InvalidPlaylistHierarchyError';
  }
}
