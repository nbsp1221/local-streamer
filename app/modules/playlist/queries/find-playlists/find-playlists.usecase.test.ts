import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistRepository, UserRepository } from '~/repositories/interfaces';
import { ValidationError } from '~/lib/errors';
import type { Playlist } from '../../domain/playlist.types';
import type { FindPlaylistsUseCaseRequest } from './find-playlists.types';
import { FindPlaylistsUseCase } from './find-playlists.usecase';

describe('FindPlaylistsUseCase', () => {
  let useCase: FindPlaylistsUseCase;
  let mockPlaylistRepository: PlaylistRepository;
  let mockUserRepository: UserRepository;
  let mockLogger: any;

  const mockPlaylists: Playlist[] = [
    {
      id: 'playlist-1',
      name: 'Action Movies',
      description: 'Best action movies',
      type: 'user_created',
      videoIds: ['video-1', 'video-2', 'video-3'],
      thumbnailUrl: undefined,
      ownerId: 'user-123',
      isPublic: true,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-15'),
      metadata: { genre: ['action', 'movies'] },
    },
    {
      id: 'playlist-2',
      name: 'Anime Series',
      description: 'My favorite anime',
      type: 'series',
      videoIds: ['video-4', 'video-5'],
      thumbnailUrl: undefined,
      ownerId: 'user-123',
      isPublic: false,
      createdAt: new Date('2023-02-01'),
      updatedAt: new Date('2023-02-10'),
      metadata: { genre: ['anime'], seriesName: 'Test Anime' },
    },
    {
      id: 'playlist-3',
      name: 'Comedy Shows',
      description: 'Funny stuff',
      type: 'user_created',
      videoIds: ['video-6'],
      thumbnailUrl: undefined,
      ownerId: 'user-456',
      isPublic: true,
      createdAt: new Date('2023-03-01'),
      updatedAt: new Date('2023-03-05'),
      metadata: { genre: ['comedy'] },
    },
    {
      id: 'playlist-4',
      name: 'Empty Playlist',
      description: 'No videos yet',
      type: 'user_created',
      videoIds: [],
      thumbnailUrl: undefined,
      ownerId: 'user-123',
      isPublic: true,
      createdAt: new Date('2023-04-01'),
      updatedAt: new Date('2023-04-01'),
      metadata: undefined,
    },
  ];

  beforeEach(() => {
    mockPlaylistRepository = {
      findWithFilters: vi.fn(),
    } as any;

    mockUserRepository = {
      exists: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    useCase = new FindPlaylistsUseCase({
      playlistRepository: mockPlaylistRepository,
      userRepository: mockUserRepository,
      logger: mockLogger,
    });
  });

  describe('successful queries', () => {
    it('should find all public playlists without user', async () => {
      const request: FindPlaylistsUseCaseRequest = {};

      const publicPlaylists = mockPlaylists.filter(p => p.isPublic);
      mockPlaylistRepository.findWithFilters = vi.fn().mockResolvedValue(publicPlaylists);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlists).toHaveLength(3); // 3 public playlists
        expect(result.data.totalCount).toBe(3);
        expect(result.data.hasMore).toBe(false);
        expect(result.data.pagination.currentPage).toBe(1);
        expect(result.data.pagination.totalPages).toBe(1);
      }

      expect(mockPlaylistRepository.findWithFilters).toHaveBeenCalledWith({
        isPublic: true,
      });
    });

    it('should find playlists with sorting by name ascending', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        sortBy: 'name',
        sortOrder: 'asc',
      };

      mockPlaylistRepository.findWithFilters = vi.fn().mockResolvedValue(mockPlaylists);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        const names = result.data.playlists.map(p => p.name);
        expect(names).toEqual(['Action Movies', 'Anime Series', 'Comedy Shows', 'Empty Playlist']);
      }
    });

    it('should find playlists with sorting by video count descending', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        sortBy: 'videoCount',
        sortOrder: 'desc',
      };

      mockPlaylistRepository.findWithFilters = vi.fn().mockResolvedValue(mockPlaylists);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        const videoCounts = result.data.playlists.map(p => p.videoIds.length);
        expect(videoCounts).toEqual([3, 2, 1, 0]); // Descending order
      }
    });

    it('should apply pagination correctly', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        limit: 2,
        offset: 1,
      };

      mockPlaylistRepository.findWithFilters = vi.fn().mockResolvedValue(mockPlaylists);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlists).toHaveLength(2); // Limit of 2
        expect(result.data.totalCount).toBe(4); // Total available
        expect(result.data.hasMore).toBe(true); // More results available
        expect(result.data.pagination.currentPage).toBe(1); // offset 1 with limit 2 = page 1
        expect(result.data.pagination.totalPages).toBe(2); // 4 total / 2 per page = 2 pages
      }
    });

    it('should exclude empty playlists when requested', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        includeEmpty: false,
      };

      mockPlaylistRepository.findWithFilters = vi.fn().mockResolvedValue(mockPlaylists);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlists).toHaveLength(3); // Exclude empty playlist
        expect(result.data.playlists.every(p => p.videoIds.length > 0)).toBe(true);
      }
    });

    it('should include stats when requested', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        includeStats: true,
        limit: 2,
      };

      mockPlaylistRepository.findWithFilters = vi.fn().mockResolvedValue(mockPlaylists);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stats).toBeDefined();
        expect(result.data.stats).toHaveLength(2); // Same as playlist count
        if (result.data.stats) {
          expect(result.data.stats[0]).toHaveProperty('id');
          expect(result.data.stats[0]).toHaveProperty('totalVideos');
          expect(result.data.stats[0]).toHaveProperty('popularityScore');
        }
      }
    });

    it('should filter by playlist type', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        filters: {
          type: 'series',
        },
      };

      const seriesPlaylists = mockPlaylists.filter(p => p.type === 'series');
      mockPlaylistRepository.findWithFilters = vi.fn().mockResolvedValue(seriesPlaylists);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlists).toHaveLength(1);
        expect(result.data.playlists[0].type).toBe('series');
      }

      expect(mockPlaylistRepository.findWithFilters).toHaveBeenCalledWith({
        type: 'series',
        isPublic: true,
      });
    });

    it('should search by query text', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        filters: {
          searchQuery: 'action',
        },
      };

      const actionPlaylists = mockPlaylists.filter(p => p.name.toLowerCase().includes('action') ||
        p.description?.toLowerCase().includes('action'));
      mockPlaylistRepository.findWithFilters = vi.fn().mockResolvedValue(actionPlaylists);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlists).toHaveLength(1);
        expect(result.data.playlists[0].name).toBe('Action Movies');
      }
    });
  });

  describe('validation errors', () => {
    it('should fail with invalid limit', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        limit: 101, // Too high
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Limit must be between 1 and 100');
      }
    });

    it('should fail with negative offset', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        offset: -1,
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Offset must be non-negative');
      }
    });

    it('should fail with invalid sort field', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        sortBy: 'invalidField' as any,
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Sort field must be one of');
      }
    });

    it('should fail with invalid sort order', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        sortOrder: 'invalid' as any,
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Sort order must be "asc" or "desc"');
      }
    });

    it('should fail with empty user ID', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        userId: '   ', // Empty after trim
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('User ID cannot be empty');
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty results', async () => {
      const request: FindPlaylistsUseCaseRequest = {};

      mockPlaylistRepository.findWithFilters = vi.fn().mockResolvedValue([]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlists).toHaveLength(0);
        expect(result.data.totalCount).toBe(0);
        expect(result.data.hasMore).toBe(false);
        expect(result.data.pagination.totalPages).toBe(0);
      }
    });

    it('should handle repository error', async () => {
      const request: FindPlaylistsUseCaseRequest = {};

      mockPlaylistRepository.findWithFilters = vi.fn().mockRejectedValue(new Error('Repository error'));

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Failed to find playlists');
      }
    });

    it('should handle very large offset gracefully', async () => {
      const request: FindPlaylistsUseCaseRequest = {
        offset: 1000, // Much larger than available data
        limit: 10,
      };

      mockPlaylistRepository.findWithFilters = vi.fn().mockResolvedValue(mockPlaylists);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlists).toHaveLength(0); // No results at this offset
        expect(result.data.totalCount).toBe(4); // But total count is still correct
        expect(result.data.hasMore).toBe(false);
      }
    });
  });
});
