import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistRepository, UserRepository } from '~/repositories/interfaces';
import { ValidationError } from '~/lib/errors';
import type { Playlist } from '../../domain/playlist.types';
import {
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
} from '../../domain/playlist.errors';
import type { DeletePlaylistUseCaseRequest } from './delete-playlist.types';
import { DeletePlaylistUseCase } from './delete-playlist.usecase';

describe('DeletePlaylistUseCase', () => {
  let useCase: DeletePlaylistUseCase;
  let mockPlaylistRepository: PlaylistRepository;
  let mockUserRepository: UserRepository;
  let mockLogger: any;

  const mockPlaylist: Playlist = {
    id: 'playlist-123',
    name: 'Test Playlist',
    description: 'Test Description',
    type: 'user_created',
    videoIds: ['video-1', 'video-2'],
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
    videoIds: [],
    thumbnailUrl: undefined,
    ownerId: 'user-123',
    isPublic: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    metadata: {
      seriesName: 'Test Series',
      genre: ['anime'],
      status: 'ongoing',
    },
  };

  beforeEach(() => {
    mockPlaylistRepository = {
      findById: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findBySeries: vi.fn(),
    } as any;

    mockUserRepository = {
      exists: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    useCase = new DeletePlaylistUseCase({
      playlistRepository: mockPlaylistRepository,
      userRepository: mockUserRepository,
      logger: mockLogger,
    });
  });

  describe('successful deletion', () => {
    it('should delete user playlist successfully', async () => {
      const request: DeletePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockPlaylistRepository.delete = vi.fn().mockResolvedValue(true);
      mockPlaylistRepository.findBySeries = vi.fn().mockResolvedValue([]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.deletedPlaylistName).toBe('Test Playlist');
        expect(result.data.videosAffected).toBe(2);
        expect(result.data.message).toContain('deleted successfully');
      }

      expect(mockPlaylistRepository.delete).toHaveBeenCalledWith('playlist-123');
    });

    it('should delete empty playlist successfully', async () => {
      const emptyPlaylist = { ...mockPlaylist, videoIds: [] };
      const request: DeletePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(emptyPlaylist);
      mockPlaylistRepository.delete = vi.fn().mockResolvedValue(true);
      mockPlaylistRepository.findBySeries = vi.fn().mockResolvedValue([]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videosAffected).toBe(0);
      }
    });

    it('should delete playlist with force flag', async () => {
      const request: DeletePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        force: true,
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockPlaylistRepository.delete = vi.fn().mockResolvedValue(true);
      mockPlaylistRepository.findBySeries = vi.fn().mockResolvedValue([]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      expect(mockPlaylistRepository.delete).toHaveBeenCalledWith('playlist-123');
    });
  });

  describe('validation errors', () => {
    it('should fail with missing playlistId', async () => {
      const request: DeletePlaylistUseCaseRequest = {
        playlistId: '',
        userId: 'user-123',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Playlist ID and user ID are required');
      }
    });

    it('should fail with missing userId', async () => {
      const request: DeletePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: '',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Playlist ID and user ID are required');
      }
    });
  });

  describe('business logic errors', () => {
    it('should fail when playlist not found', async () => {
      const request: DeletePlaylistUseCaseRequest = {
        playlistId: 'nonexistent-playlist',
        userId: 'user-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistNotFoundError);
        expect(result.error.message).toContain('nonexistent-playlist');
      }
    });

    it('should fail when user is not the owner', async () => {
      const request: DeletePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'different-user',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistPermissionDeniedError);
        expect(result.error.message).toContain('does not have permission');
      }
    });

    it('should fail when repository deletion fails', async () => {
      const request: DeletePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockPlaylistRepository.delete = vi.fn().mockResolvedValue(false);
      mockPlaylistRepository.findBySeries = vi.fn().mockResolvedValue([]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to delete playlist');
      }
    });
  });

  describe('series/season relationship handling', () => {
    it('should handle series deletion with seasons', async () => {
      const mockSeasons = [
        {
          id: 'season-1',
          type: 'season',
          metadata: { parentPlaylistId: 'series-123', seasonNumber: 1 },
        },
        {
          id: 'season-2',
          type: 'season',
          metadata: { parentPlaylistId: 'series-123', seasonNumber: 2 },
        },
      ];

      const request: DeletePlaylistUseCaseRequest = {
        playlistId: 'series-123',
        userId: 'user-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockSeriesPlaylist);
      mockPlaylistRepository.delete = vi.fn().mockResolvedValue(true);
      mockPlaylistRepository.findBySeries = vi.fn().mockResolvedValue(mockSeasons);
      mockPlaylistRepository.update = vi.fn().mockResolvedValue({});

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relatedPlaylistsAffected).toEqual(['season-1', 'season-2']);
      }

      // Should update each season to remove parent reference
      expect(mockPlaylistRepository.update).toHaveBeenCalledTimes(2);
    });

    it('should handle season deletion and update parent series', async () => {
      const mockSeasonPlaylist = {
        ...mockPlaylist,
        id: 'season-1',
        type: 'season',
        metadata: {
          seriesName: 'Test Series',
          seasonNumber: 1,
          parentPlaylistId: 'series-123',
          episodeCount: 12,
        },
      };

      const request: DeletePlaylistUseCaseRequest = {
        playlistId: 'season-1',
        userId: 'user-123',
      };

      mockPlaylistRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockSeasonPlaylist)
        .mockResolvedValueOnce(mockSeriesPlaylist);
      mockPlaylistRepository.delete = vi.fn().mockResolvedValue(true);
      mockPlaylistRepository.findBySeries = vi.fn().mockResolvedValue([
        { id: 'season-2', type: 'season', metadata: { episodeCount: 10 } },
      ]);
      mockPlaylistRepository.update = vi.fn().mockResolvedValue({});

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relatedPlaylistsAffected).toEqual(['series-123']);
      }

      // Should update parent series with recalculated episode count
      expect(mockPlaylistRepository.update).toHaveBeenCalledWith('series-123', {
        metadata: expect.objectContaining({
          episodeCount: 10, // Only remaining season's episodes
        }),
      });
    });
  });
});
