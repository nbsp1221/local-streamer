import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistRepository, UserRepository, VideoRepository } from '~/repositories/interfaces';
import { ValidationError } from '~/lib/errors';
import type { Playlist } from '../../domain/playlist.types';
import {
  DuplicateVideoInPlaylistError,
  InvalidPlaylistPositionError,
  PlaylistNotFoundError,
  PlaylistPermissionDeniedError,
} from '../../domain/playlist.errors';
import type { AddVideoToPlaylistUseCaseRequest } from './add-video-to-playlist.types';
import { AddVideoToPlaylistUseCase } from './add-video-to-playlist.usecase';

describe('AddVideoToPlaylistUseCase', () => {
  let useCase: AddVideoToPlaylistUseCase;
  let mockPlaylistRepository: PlaylistRepository;
  let mockUserRepository: UserRepository;
  let mockVideoRepository: VideoRepository;
  let mockLogger: any;

  const mockVideo = {
    id: 'video-new',
    title: 'New Video',
    description: 'New video description',
    filename: 'new-video.mp4',
    thumbnailUrl: 'thumbnail.jpg',
    duration: 120,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

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
    videoIds: ['video-1'],
    thumbnailUrl: undefined,
    ownerId: 'user-123',
    isPublic: true,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
    metadata: {
      seriesName: 'Test Series',
      episodeCount: 1,
      genre: ['anime'],
      status: 'ongoing',
    },
  };

  beforeEach(() => {
    mockPlaylistRepository = {
      findById: vi.fn(),
      addVideoToPlaylist: vi.fn(),
      update: vi.fn(),
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

    useCase = new AddVideoToPlaylistUseCase({
      playlistRepository: mockPlaylistRepository,
      userRepository: mockUserRepository,
      videoRepository: mockVideoRepository,
      logger: mockLogger,
    });
  });

  describe('successful video addition', () => {
    it('should add video to playlist successfully', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        videoId: 'video-new',
        userId: 'user-123',
      };

      const updatedPlaylist = {
        ...mockPlaylist,
        videoIds: [...mockPlaylist.videoIds, 'video-new'],
      };

      mockPlaylistRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockPlaylist)
        .mockResolvedValueOnce(updatedPlaylist);
      mockVideoRepository.findById = vi.fn().mockResolvedValue(mockVideo);
      mockPlaylistRepository.addVideoToPlaylist = vi.fn().mockResolvedValue(undefined);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.playlistName).toBe('Test Playlist');
        expect(result.data.videoTitle).toBe('New Video');
        expect(result.data.finalPosition).toBe(2); // End of existing 2 videos
        expect(result.data.totalVideosInPlaylist).toBe(3);
      }

      expect(mockPlaylistRepository.addVideoToPlaylist).toHaveBeenCalledWith(
        'playlist-123',
        'video-new',
        2,
      );
    });

    it('should add video at specific position', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        videoId: 'video-new',
        userId: 'user-123',
        position: 1, // Insert at position 1
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockVideoRepository.findById = vi.fn().mockResolvedValue(mockVideo);
      mockPlaylistRepository.addVideoToPlaylist = vi.fn().mockResolvedValue(undefined);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.finalPosition).toBe(1);
      }

      expect(mockPlaylistRepository.addVideoToPlaylist).toHaveBeenCalledWith(
        'playlist-123',
        'video-new',
        1,
      );
    });

    it('should add video with episode metadata', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        videoId: 'video-new',
        userId: 'user-123',
        episodeMetadata: {
          episodeNumber: 3,
          episodeTitle: 'Episode 3',
          duration: 1440,
        },
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockVideoRepository.findById = vi.fn().mockResolvedValue(mockVideo);
      mockPlaylistRepository.addVideoToPlaylist = vi.fn().mockResolvedValue(undefined);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);
    });
  });

  describe('validation errors', () => {
    it('should fail with missing required fields', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: '',
        videoId: 'video-new',
        userId: 'user-123',
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Playlist ID, video ID, and user ID are required');
      }
    });

    it('should fail with invalid position', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        videoId: 'video-new',
        userId: 'user-123',
        position: -1,
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Position must be a non-negative integer');
      }
    });

    it('should fail with invalid episode metadata', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        videoId: 'video-new',
        userId: 'user-123',
        episodeMetadata: {
          episodeNumber: 0, // Invalid episode number
        },
      };

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Episode number must be a positive integer');
      }
    });
  });

  describe('business logic errors', () => {
    it('should fail when playlist not found', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'nonexistent-playlist',
        videoId: 'video-new',
        userId: 'user-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistNotFoundError);
      }
    });

    it('should fail when user is not the owner', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        videoId: 'video-new',
        userId: 'different-user',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(PlaylistPermissionDeniedError);
      }
    });

    it('should fail when video not found', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        videoId: 'nonexistent-video',
        userId: 'user-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockVideoRepository.findById = vi.fn().mockResolvedValue(null);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Video with ID "nonexistent-video" not found');
      }
    });

    it('should fail when video already in playlist', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        videoId: 'video-1', // Already in playlist
        userId: 'user-123',
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockVideoRepository.findById = vi.fn().mockResolvedValue(mockVideo);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(DuplicateVideoInPlaylistError);
      }
    });

    it('should fail when position is out of range', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'playlist-123',
        videoId: 'video-new',
        userId: 'user-123',
        position: 10, // Too high for playlist with 2 videos
      };

      mockPlaylistRepository.findById = vi.fn().mockResolvedValue(mockPlaylist);
      mockVideoRepository.findById = vi.fn().mockResolvedValue(mockVideo);

      const result = await useCase.execute(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InvalidPlaylistPositionError);
      }
    });
  });

  describe('series metadata updates', () => {
    it('should update episode count for series playlist', async () => {
      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'series-123',
        videoId: 'video-new',
        userId: 'user-123',
      };

      const updatedSeriesPlaylist = {
        ...mockSeriesPlaylist,
        videoIds: [...mockSeriesPlaylist.videoIds, 'video-new'],
      };

      mockPlaylistRepository.findById = vi.fn()
        .mockResolvedValueOnce(mockSeriesPlaylist)
        .mockResolvedValueOnce(updatedSeriesPlaylist);
      mockVideoRepository.findById = vi.fn().mockResolvedValue(mockVideo);
      mockPlaylistRepository.addVideoToPlaylist = vi.fn().mockResolvedValue(undefined);
      mockPlaylistRepository.update = vi.fn().mockResolvedValue({});

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);

      // Should update episode count
      expect(mockPlaylistRepository.update).toHaveBeenCalledWith(
        'series-123',
        {
          metadata: expect.objectContaining({
            episodeCount: 2, // Original 1 + new video
          }),
        },
      );
    });

    it('should update parent series when adding to season', async () => {
      const seasonPlaylist = {
        ...mockPlaylist,
        type: 'season',
        metadata: {
          seriesName: 'Test Series',
          seasonNumber: 1,
          parentPlaylistId: 'series-123',
          episodeCount: 2,
        },
      };

      const request: AddVideoToPlaylistUseCaseRequest = {
        playlistId: 'season-123',
        videoId: 'video-new',
        userId: 'user-123',
      };

      mockPlaylistRepository.findById = vi.fn()
        .mockResolvedValueOnce(seasonPlaylist)
        .mockResolvedValueOnce(mockSeriesPlaylist);
      mockVideoRepository.findById = vi.fn().mockResolvedValue(mockVideo);
      mockPlaylistRepository.addVideoToPlaylist = vi.fn().mockResolvedValue(undefined);
      mockPlaylistRepository.update = vi.fn().mockResolvedValue({});
      mockPlaylistRepository.findBySeries = vi.fn().mockResolvedValue([seasonPlaylist]);

      const result = await useCase.execute(request);

      expect(result.success).toBe(true);

      // Should update both season and parent series
      expect(mockPlaylistRepository.update).toHaveBeenCalledTimes(2);
    });
  });
});
