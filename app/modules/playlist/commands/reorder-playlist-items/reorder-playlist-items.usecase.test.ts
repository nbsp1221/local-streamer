import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistRepository, UserRepository } from '~/repositories/interfaces';
import { ValidationError } from '~/lib/errors';
import type { Playlist } from '../../domain/playlist.types';
import {
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
  PlaylistReorderError,
} from '../../domain/playlist.errors';
import type { ReorderPlaylistItemsUseCaseRequest } from './reorder-playlist-items.types';
import { ReorderPlaylistItemsUseCase } from './reorder-playlist-items.usecase';

describe('ReorderPlaylistItemsUseCase', () => {
  let useCase: ReorderPlaylistItemsUseCase;
  let mockPlaylistRepository: PlaylistRepository;
  let mockUserRepository: UserRepository;
  let mockLogger: any;

  const mockPlaylist: Playlist = {
    id: 'playlist-123',
    name: 'Test Playlist',
    description: 'Test Description',
    type: 'user_created',
    videoIds: ['video-1', 'video-2', 'video-3', 'video-4'],
    thumbnailUrl: undefined,
    ownerId: 'user-123',
    isPublic: false,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    metadata: undefined,
  };

  const mockSeriesPlaylist: Playlist = {
    id: 'series-123',
    name: 'Test Series',
    description: 'Test Series Description',
    type: 'series',
    videoIds: ['ep-1', 'ep-2', 'ep-3'],
    thumbnailUrl: undefined,
    ownerId: 'user-123',
    isPublic: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    metadata: {
      seriesName: 'Test Series',
      episodeCount: 3,
      genre: ['anime'],
      status: 'ongoing',
    },
  };

  beforeEach(() => {
    mockPlaylistRepository = {
      findById: vi.fn(),
      reorderPlaylistItems: vi.fn(),
      update: vi.fn(),
    } as any;

    mockUserRepository = {
      exists: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    useCase = new ReorderPlaylistItemsUseCase({
      playlistRepository: mockPlaylistRepository,
      userRepository: mockUserRepository,
      logger: mockLogger,
    });
  });

  describe('successful reordering', () => {
    it('should reorder playlist items successfully', async () => {
      const newOrder = ['video-2', 'video-4', 'video-1', 'video-3'];
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder,
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockPlaylistRepository.reorderPlaylistItems = vi.fn().mockResolvedValue(undefined);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.playlistName).toBe('Test Playlist');
        expect(result.data.videosReordered).toBe(4);
        expect(result.data.oldOrder).toEqual(['video-1', 'video-2', 'video-3', 'video-4']);
        expect(result.data.newOrder).toEqual(newOrder);
        expect(result.data.message).toContain('reordered successfully');
      }

      expect(mockPlaylistRepository.reorderPlaylistItems).toHaveBeenCalledWith(
        'playlist-123',
        newOrder,
      );
    });

    it('should handle reverse order reordering', async () => {
      const newOrder = ['video-4', 'video-3', 'video-2', 'video-1'];
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder,
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockPlaylistRepository.reorderPlaylistItems = vi.fn().mockResolvedValue(undefined);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.newOrder).toEqual(newOrder);
      }
    });

    it('should handle no changes gracefully', async () => {
      const sameOrder = ['video-1', 'video-2', 'video-3', 'video-4']; // Same as original
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder: sameOrder,
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videosReordered).toBe(0);
        expect(result.data.message).toContain('No changes were made');
      }

      // Should not call repository reorder method
      expect(mockPlaylistRepository.reorderPlaylistItems).not.toHaveBeenCalled();
    });

    it('should preserve metadata for series playlist', async () => {
      const newOrder = ['ep-3', 'ep-1', 'ep-2'];
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'series-123',
        userId: 'user-123',
        newOrder,
        preserveMetadata: true,
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockSeriesPlaylist);
      mockPlaylistRepository.reorderPlaylistItems = vi.fn().mockResolvedValue(undefined);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Episode metadata preserved after reorder',
        expect.objectContaining({
          playlistId: 'series-123',
          type: 'series',
        }),
      );
    });
  });

  describe('validation errors', () => {
    it('should fail with missing required fields', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: '',
        userId: 'user-123',
        newOrder: ['video-1', 'video-2'],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Playlist ID, user ID, and new order are required');
      }
    });

    it('should fail with invalid new order type', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder: 'not-an-array' as any,
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('New order must be an array');
      }
    });

    it('should fail with empty new order', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder: [],
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('New order cannot be empty');
      }
    });

    it('should fail with duplicate video IDs in new order', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder: ['video-1', 'video-2', 'video-1'], // Duplicate video-1
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistReorderError);
        expect(result.error.message).toContain('duplicate video IDs');
      }
    });

    it('should fail with invalid video ID format', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder: ['video-1', '', 'video-3'], // Empty video ID
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('must be non-empty strings');
      }
    });
  });

  describe('business logic errors', () => {
    it('should fail when playlist not found', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'nonexistent-playlist',
        userId: 'user-123',
        newOrder: ['video-1', 'video-2'],
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistNotFoundError);
      }
    });

    it('should fail when user is not the owner', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'different-user',
        newOrder: ['video-1', 'video-2', 'video-3', 'video-4'],
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistPermissionDeniedError);
      }
    });

    it('should fail when new order has different length', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder: ['video-1', 'video-2'], // Missing videos 3 and 4
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistReorderError);
        expect(result.error.message).toContain('New order has 2 videos, but playlist has 4 videos');
      }
    });

    it('should fail when new order contains different videos', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder: ['video-1', 'video-2', 'video-5', 'video-6'], // Different videos
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistReorderError);
        expect(result.error.message).toContain('not in current playlist');
      }
    });

    it('should fail when new order is missing existing videos', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder: ['video-1', 'video-2', 'video-3', 'video-1'], // Missing video-4, duplicate video-1
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistReorderError);
        expect(result.error.message).toContain('duplicate video IDs');
      }
    });

    it('should fail when repository reorder fails', async () => {
      const request: ReorderPlaylistItemsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        newOrder: ['video-2', 'video-1', 'video-4', 'video-3'],
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockPlaylistRepository.reorderPlaylistItems = vi.fn().mockRejectedValue(new Error('Repository error'));

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to reorder playlist');
      }
    });
  });
});
