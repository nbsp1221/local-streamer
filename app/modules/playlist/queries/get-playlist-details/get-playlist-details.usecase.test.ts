import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistRepository, UserRepository, VideoRepository } from '~/repositories/interfaces';
import { ValidationError } from '~/lib/errors';
import type { Playlist } from '../../domain/playlist.types';
import {
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
} from '../../domain/playlist.errors';
import type { GetPlaylistDetailsUseCaseRequest } from './get-playlist-details.types';
import { GetPlaylistDetailsUseCase } from './get-playlist-details.usecase';

describe('GetPlaylistDetailsUseCase', () => {
  let useCase: GetPlaylistDetailsUseCase;
  let mockPlaylistRepository: PlaylistRepository;
  let mockUserRepository: UserRepository;
  let mockVideoRepository: VideoRepository;
  let mockLogger: any;

  const mockVideos = [
    { id: 'video-1', title: 'Video 1', thumbnailUrl: 'thumb1.jpg', duration: 120 },
    { id: 'video-2', title: 'Video 2', thumbnailUrl: 'thumb2.jpg', duration: 180 },
    { id: 'video-3', title: 'Video 3', thumbnailUrl: 'thumb3.jpg', duration: 240 },
  ];

  const mockPublicPlaylist: Playlist = {
    id: 'playlist-123',
    name: 'Test Playlist',
    description: 'Test Description',
    type: 'user_created',
    videoIds: ['video-1', 'video-2', 'video-3'],
    thumbnailUrl: undefined,
    ownerId: 'user-123',
    isPublic: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-15'),
    metadata: undefined,
  };

  const mockPrivatePlaylist: Playlist = {
    id: 'playlist-456',
    name: 'Private Playlist',
    description: 'Private Description',
    type: 'user_created',
    videoIds: ['video-1'],
    thumbnailUrl: undefined,
    ownerId: 'user-123',
    isPublic: false,
    createdAt: new Date('2023-02-01'),
    updatedAt: new Date('2023-02-10'),
    metadata: undefined,
  };

  const mockSeriesPlaylist: Playlist = {
    id: 'series-789',
    name: 'Test Series',
    description: 'Test Series Description',
    type: 'series',
    videoIds: ['video-1', 'video-2'],
    thumbnailUrl: undefined,
    ownerId: 'user-123',
    isPublic: true,
    createdAt: new Date('2023-03-01'),
    updatedAt: new Date('2023-03-05'),
    metadata: {
      seriesName: 'Test Series',
      episodeCount: 2,
      genre: ['anime'],
      status: 'ongoing',
    },
  };

  beforeEach(() => {
    mockPlaylistRepository = {
      findById: vi.fn(),
      findBySeries: vi.fn(),
    } as any;

    mockUserRepository = {
      exists: vi.fn(),
    } as any;

    mockVideoRepository = {
      findById: vi.fn(),
    } as any;

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    useCase = new GetPlaylistDetailsUseCase({
      playlistRepository: mockPlaylistRepository,
      userRepository: mockUserRepository,
      videoRepository: mockVideoRepository,
      logger: mockLogger,
    });
  });

  describe('successful queries', () => {
    it('should get public playlist details for anonymous user', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPublicPlaylist);
      mockVideoRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockVideos[0])
        .mockResolvedValueOnce(mockVideos[1])
        .mockResolvedValueOnce(mockVideos[2]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlist.id).toBe('playlist-123');
        expect(result.data.playlist.name).toBe('Test Playlist');
        expect(result.data.playlist.videos).toHaveLength(3);
        expect(result.data.permissions.canEdit).toBe(false);
        expect(result.data.permissions.canDelete).toBe(false);
        expect(result.data.permissions.canAddVideos).toBe(false);
        expect(result.data.permissions.canShare).toBe(true); // Public playlist
      }
    });

    it('should get playlist details for owner with full permissions', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-123',
        userId: 'user-123', // Owner
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPublicPlaylist);
      mockVideoRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockVideos[0])
        .mockResolvedValueOnce(mockVideos[1])
        .mockResolvedValueOnce(mockVideos[2]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.permissions.canEdit).toBe(true);
        expect(result.data.permissions.canDelete).toBe(true);
        expect(result.data.permissions.canAddVideos).toBe(true);
        expect(result.data.permissions.canShare).toBe(true);
      }
    });

    it('should get playlist details with video pagination', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-123',
        videoLimit: 2,
        videoOffset: 1,
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPublicPlaylist);
      mockVideoRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockVideos[1])
        .mockResolvedValueOnce(mockVideos[2]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlist.videos).toHaveLength(2);
        expect(result.data.playlist.videos[0].title).toBe('Video 2');
        expect(result.data.playlist.videos[0].position).toBe(2); // 1-based position
        expect(result.data.videoPagination).toEqual({
          total: 3,
          limit: 2,
          offset: 1,
          hasMore: false,
        });
      }
    });

    it('should get playlist details without videos', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-123',
        includeVideos: false,
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPublicPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlist.videos).toHaveLength(0);
        expect(result.data.videoPagination).toBeUndefined();
      }

      expect(mockVideoRepository.findById).not.toHaveBeenCalled();
    });

    it('should get playlist details with stats', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-123',
        includeStats: true,
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPublicPlaylist);
      mockVideoRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockVideos[0])
        .mockResolvedValueOnce(mockVideos[1])
        .mockResolvedValueOnce(mockVideos[2]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stats).toBeDefined();
        if (result.data.stats) {
          expect(result.data.stats.id).toBe('playlist-123');
          expect(result.data.stats.totalVideos).toBe(3);
          expect(result.data.stats).toHaveProperty('popularityScore');
        }
        expect(result.data.playlist.stats).toBeDefined();
      }
    });

    it('should get series playlist with related playlists', async () => {
      const mockSeasons = [
        {
          id: 'season-1',
          name: 'Season 1',
          type: 'season',
          videoIds: ['ep-1', 'ep-2'],
          metadata: { seriesName: 'Test Series', seasonNumber: 1 },
        },
        {
          id: 'season-2',
          name: 'Season 2',
          type: 'season',
          videoIds: ['ep-3'],
          metadata: { seriesName: 'Test Series', seasonNumber: 2 },
        },
      ];

      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'series-789',
        includeRelated: true,
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockSeriesPlaylist);
      mockPlaylistRepository.findBySeries = vi.fn().mockResolvedValue([
        mockSeriesPlaylist,
        ...mockSeasons,
      ]);
      mockVideoRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockVideos[0])
        .mockResolvedValueOnce(mockVideos[1]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.relatedPlaylists).toBeDefined();
        expect(result.data.relatedPlaylists).toHaveLength(2);
        if (result.data.relatedPlaylists) {
          expect(result.data.relatedPlaylists[0].relationship).toBe('child');
          expect(result.data.relatedPlaylists[0].type).toBe('season');
        }
      }
    });
  });

  describe('access control', () => {
    it('should allow owner to access private playlist', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-456',
        userId: 'user-123', // Owner
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPrivatePlaylist);
      mockVideoRepository.findById = vi.fn().mockResolvedValue(mockVideos[0]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.playlist.id).toBe('playlist-456');
      }
    });

    it('should deny anonymous user access to private playlist', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-456',
        // No userId provided
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPrivatePlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistPermissionDeniedError);
      }
    });

    it('should deny non-owner access to private playlist', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-456',
        userId: 'different-user',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPrivatePlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistPermissionDeniedError);
      }
    });
  });

  describe('validation errors', () => {
    it('should fail with missing playlist ID', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: '',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Playlist ID is required');
      }
    });

    it('should fail with invalid video limit', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-123',
        videoLimit: 101, // Too high
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Video limit must be between 1 and 100');
      }
    });

    it('should fail with negative video offset', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-123',
        videoOffset: -1,
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Video offset must be non-negative');
      }
    });

    it('should fail with empty user ID', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-123',
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

  describe('error handling', () => {
    it('should fail when playlist not found', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'nonexistent-playlist',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistNotFoundError);
      }
    });

    it('should handle missing videos gracefully', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPublicPlaylist);
      mockVideoRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockVideos[0])
        .mockResolvedValueOnce(null) // Video 2 not found
        .mockResolvedValueOnce(mockVideos[2]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should only include found videos but maintain structure
        expect(result.data.playlist.videos).toHaveLength(2);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Video not found in playlist',
          expect.objectContaining({ videoId: 'video-2' }),
        );
      }
    });

    it('should handle video repository errors gracefully', async () => {
      const request: GetPlaylistDetailsUseCaseRequest = {
        playlistId: 'playlist-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPublicPlaylist);
      mockVideoRepository.findById = vi.fn().mockRejectedValue(new Error('Video repository error'));

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should return empty videos array when video fetching fails
        expect(result.data.playlist.videos).toHaveLength(0);
        expect(mockLogger.warn).toHaveBeenCalled();
      }
    });
  });
});
