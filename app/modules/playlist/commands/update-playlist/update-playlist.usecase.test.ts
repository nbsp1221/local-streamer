import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistRepository, UserRepository } from '~/repositories/interfaces';
import { ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import type { Playlist } from '../../domain/playlist.types';
import {
  DuplicatePlaylistNameError,
  InvalidPlaylistDataError,
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
} from '../../domain/playlist.errors';
import type { UpdatePlaylistUseCaseRequest } from './update-playlist.types';
import { UpdatePlaylistUseCase } from './update-playlist.usecase';

describe('UpdatePlaylistUseCase', () => {
  let useCase: UpdatePlaylistUseCase;
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

  beforeEach(() => {
    mockPlaylistRepository = {
      findById: vi.fn(),
      update: vi.fn(),
      nameExistsForUser: vi.fn(),
    } as any;

    mockUserRepository = {
      exists: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    useCase = new UpdatePlaylistUseCase({
      playlistRepository: mockPlaylistRepository,
      userRepository: mockUserRepository,
      logger: mockLogger,
    });
  });

  describe('successful update', () => {
    it('should update playlist name successfully', async () => {
      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        name: 'Updated Playlist Name',
      };

      const updatedPlaylist = {
        ...mockPlaylist,
        name: 'Updated Playlist Name',
        updatedAt: new Date(),
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockPlaylistRepository.nameExistsForUser = vi.fn().mockResolvedValue(false);
      mockPlaylistRepository.update = vi.fn().mockResolvedValue(updatedPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlist.name).toBe('Updated Playlist Name');
        expect(result.data.fieldsUpdated).toEqual(['name']);
        expect(result.data.message).toContain('updated successfully');
      }
    });

    it('should update multiple fields successfully', async () => {
      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        name: 'New Name',
        description: 'New Description',
        isPublic: true,
      };

      const updatedPlaylist = {
        ...mockPlaylist,
        name: 'New Name',
        description: 'New Description',
        isPublic: true,
        updatedAt: new Date(),
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockPlaylistRepository.nameExistsForUser = vi.fn().mockResolvedValue(false);
      mockPlaylistRepository.update = vi.fn().mockResolvedValue(updatedPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fieldsUpdated).toEqual(['name', 'description', 'isPublic']);
      }
    });

    it('should handle no changes gracefully', async () => {
      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        name: mockPlaylist.name, // Same name
        description: mockPlaylist.description, // Same description
        isPublic: mockPlaylist.isPublic, // Same visibility
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fieldsUpdated).toEqual([]);
        expect(result.data.message).toContain('No changes were made');
      }
      expect(mockPlaylistRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('validation errors', () => {
    it('should fail with missing playlistId', async () => {
      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: '',
        userId: 'user-123',
        name: 'New Name',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Playlist ID and user ID are required');
      }
    });

    it('should fail with no update fields provided', async () => {
      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('At least one field must be provided for update');
      }
    });

    it('should fail with empty name', async () => {
      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        name: '   ', // Empty after trim
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InvalidPlaylistDataError);
        expect(result.error.message).toContain('Invalid playlist name: cannot be empty');
      }
    });

    it('should fail with name too long', async () => {
      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        name: 'a'.repeat(256), // Too long
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InvalidPlaylistDataError);
        expect(result.error.message).toContain('cannot exceed 255 characters');
      }
    });
  });

  describe('business logic errors', () => {
    it('should fail when playlist not found', async () => {
      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: 'nonexistent-playlist',
        userId: 'user-123',
        name: 'New Name',
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
      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'different-user',
        name: 'New Name',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistPermissionDeniedError);
        expect(result.error.message).toContain('does not have permission');
      }
    });

    it('should fail when new name already exists for user', async () => {
      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        name: 'Existing Playlist Name',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockPlaylistRepository.nameExistsForUser = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DuplicatePlaylistNameError);
        expect(result.error.message).toContain('already exists');
      }
    });
  });

  describe('metadata validation', () => {
    it('should validate series metadata correctly', async () => {
      const seriesPlaylist = {
        ...mockPlaylist,
        type: 'series' as const,
        metadata: { seriesName: 'Test Series' },
      };

      const request: UpdatePlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123',
        metadata: {
          seriesName: '', // Invalid empty series name
        },
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(seriesPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('seriesName cannot be empty');
      }
    });
  });
});
