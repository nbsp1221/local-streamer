import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InternalError, NotFoundError, ValidationError } from '~/lib/errors';
import type { DeleteVideoDependencies, DeleteVideoRequest } from './delete-video.types';
import { DeleteVideoUseCase } from './delete-video.usecase';

describe('DeleteVideoUseCase', () => {
  let useCase: DeleteVideoUseCase;
  let mockDependencies: DeleteVideoDependencies;
  let mockVideoRepository: any;
  let mockWorkspaceManager: any;
  let mockLogger: any;

  beforeEach(() => {
    // Create mock video repository
    mockVideoRepository = {
      findById: vi.fn(),
      delete: vi.fn(),
    };

    // Create mock workspace manager
    mockWorkspaceManager = {
      cleanupWorkspace: vi.fn(),
    };

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    // Setup dependencies
    mockDependencies = {
      videoRepository: mockVideoRepository,
      workspaceManager: mockWorkspaceManager,
      logger: mockLogger,
    };

    useCase = new DeleteVideoUseCase(mockDependencies);
  });

  describe('Successful deletion', () => {
    it('should delete video successfully', async () => {
      // Arrange
      const request: DeleteVideoRequest = {
        videoId: 'video-123',
      };

      const mockVideo = {
        id: 'video-123',
        title: 'Test Video',
        tags: ['test'],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        createdAt: new Date(),
      };

      mockVideoRepository.findById.mockResolvedValue(mockVideo);
      mockVideoRepository.delete.mockResolvedValue(undefined);
      mockWorkspaceManager.cleanupWorkspace.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videoId).toBe('video-123');
        expect(result.data.title).toBe('Test Video');
        expect(result.data.message).toBe('Video deleted successfully');
      }

      expect(mockVideoRepository.findById).toHaveBeenCalledWith('video-123');
      expect(mockVideoRepository.delete).toHaveBeenCalledWith('video-123');
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledWith('video-123');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Video metadata deleted: Test Video (video-123)',
      );
      expect(mockLogger.info).toHaveBeenCalledWith('Video files deleted: video-123');
    });

    it('should succeed even when file deletion fails', async () => {
      // Arrange
      const request: DeleteVideoRequest = {
        videoId: 'video-123',
      };

      const mockVideo = {
        id: 'video-123',
        title: 'Test Video',
        tags: ['test'],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        createdAt: new Date(),
      };

      mockVideoRepository.findById.mockResolvedValue(mockVideo);
      mockVideoRepository.delete.mockResolvedValue(undefined);
      mockWorkspaceManager.cleanupWorkspace.mockRejectedValue(new Error('File system error'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videoId).toBe('video-123');
        expect(result.data.title).toBe('Test Video');
        expect(result.data.message).toBe('Video deleted successfully');
      }

      expect(mockVideoRepository.delete).toHaveBeenCalledWith('video-123');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to delete video files for video-123, manual cleanup needed',
        expect.any(Error),
      );
    });
  });

  describe('Validation errors', () => {
    it('should fail when videoId is missing', async () => {
      // Arrange
      const request: DeleteVideoRequest = {
        videoId: '',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Video ID must be a non-empty string');
      }

      expect(mockVideoRepository.findById).not.toHaveBeenCalled();
    });

    it('should fail when videoId is not a string', async () => {
      // Arrange
      const request = {
        videoId: null,
      } as any;

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Video ID must be a non-empty string');
      }
    });

    it('should fail when videoId is only whitespace', async () => {
      // Arrange
      const request: DeleteVideoRequest = {
        videoId: '   ',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Video ID must be a non-empty string');
      }
    });
  });

  describe('Video not found', () => {
    it('should fail when video does not exist', async () => {
      // Arrange
      const request: DeleteVideoRequest = {
        videoId: 'nonexistent-video',
      };

      mockVideoRepository.findById.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toContain('Video not found');
      }

      expect(mockVideoRepository.findById).toHaveBeenCalledWith('nonexistent-video');
      expect(mockVideoRepository.delete).not.toHaveBeenCalled();
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('Database operation failures', () => {
    it('should fail when repository findById fails', async () => {
      // Arrange
      const request: DeleteVideoRequest = {
        videoId: 'video-123',
      };

      mockVideoRepository.findById.mockRejectedValue(new Error('Database connection error'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Database connection error');
      }

      expect(mockVideoRepository.delete).not.toHaveBeenCalled();
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
    });

    it('should fail when repository delete fails', async () => {
      // Arrange
      const request: DeleteVideoRequest = {
        videoId: 'video-123',
      };

      const mockVideo = {
        id: 'video-123',
        title: 'Test Video',
        tags: ['test'],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        createdAt: new Date(),
      };

      mockVideoRepository.findById.mockResolvedValue(mockVideo);
      mockVideoRepository.delete.mockRejectedValue(new Error('Database write error'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Database write error');
      }

      expect(mockVideoRepository.findById).toHaveBeenCalledWith('video-123');
      expect(mockVideoRepository.delete).toHaveBeenCalledWith('video-123');
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('Error handling without logger', () => {
    it('should work correctly without logger dependency', async () => {
      // Arrange
      const depsWithoutLogger = {
        videoRepository: mockVideoRepository,
        workspaceManager: mockWorkspaceManager,
        // No logger
      };

      const useCaseWithoutLogger = new DeleteVideoUseCase(depsWithoutLogger);

      const request: DeleteVideoRequest = {
        videoId: 'video-123',
      };

      const mockVideo = {
        id: 'video-123',
        title: 'Test Video',
        tags: ['test'],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        createdAt: new Date(),
      };

      mockVideoRepository.findById.mockResolvedValue(mockVideo);
      mockVideoRepository.delete.mockResolvedValue(undefined);
      mockWorkspaceManager.cleanupWorkspace.mockResolvedValue(undefined);

      // Act
      const result = await useCaseWithoutLogger.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videoId).toBe('video-123');
        expect(result.data.title).toBe('Test Video');
      }
    });
  });
});
