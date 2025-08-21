import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InternalError, NotFoundError, ValidationError } from '~/lib/errors';
import type { UpdateVideoDependencies, UpdateVideoRequest } from './update-video.types';
import { UpdateVideoUseCase } from './update-video.usecase';

describe('UpdateVideoUseCase', () => {
  let useCase: UpdateVideoUseCase;
  let mockDependencies: UpdateVideoDependencies;
  let mockVideoRepository: any;
  let mockLogger: any;

  beforeEach(() => {
    // Create mock video repository
    mockVideoRepository = {
      findById: vi.fn(),
      update: vi.fn(),
    };

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    // Setup dependencies
    mockDependencies = {
      videoRepository: mockVideoRepository,
      logger: mockLogger,
    };

    useCase = new UpdateVideoUseCase(mockDependencies);
  });

  describe('Successful update', () => {
    it('should update video successfully with all fields', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: 'Updated Video Title',
        tags: ['tag1', 'tag2'],
        description: 'Updated description',
      };

      const existingVideo = {
        id: 'video-123',
        title: 'Old Title',
        tags: ['old'],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        format: 'mp4' as const,
        addedAt: new Date(),
        description: 'Old description',
      };

      const updatedVideo = {
        ...existingVideo,
        title: 'Updated Video Title',
        tags: ['tag1', 'tag2'],
        description: 'Updated description',
      };

      mockVideoRepository.findById.mockResolvedValue(existingVideo);
      mockVideoRepository.update.mockResolvedValue(updatedVideo);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.video.title).toBe('Updated Video Title');
        expect(result.data.video.tags).toEqual(['tag1', 'tag2']);
        expect(result.data.video.description).toBe('Updated description');
        expect(result.data.message).toBe('Video "Updated Video Title" updated successfully');
      }

      expect(mockVideoRepository.findById).toHaveBeenCalledWith('video-123');
      expect(mockVideoRepository.update).toHaveBeenCalledWith('video-123', {
        title: 'Updated Video Title',
        tags: ['tag1', 'tag2'],
        description: 'Updated description',
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Video updated: Updated Video Title (video-123)');
    });

    it('should update video with minimal fields (title only)', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: 'New Title',
      };

      const existingVideo = {
        id: 'video-123',
        title: 'Old Title',
        tags: ['old'],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        format: 'mp4' as const,
        addedAt: new Date(),
      };

      const updatedVideo = {
        ...existingVideo,
        title: 'New Title',
        tags: [],
        description: undefined,
      };

      mockVideoRepository.findById.mockResolvedValue(existingVideo);
      mockVideoRepository.update.mockResolvedValue(updatedVideo);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.video.title).toBe('New Title');
        expect(result.data.video.tags).toEqual([]);
        expect(result.data.video.description).toBeUndefined();
      }

      expect(mockVideoRepository.update).toHaveBeenCalledWith('video-123', {
        title: 'New Title',
        tags: [],
        description: undefined,
      });
    });

    it('should sanitize tags by removing empty and invalid values', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: 'Test Video',
        tags: ['valid', '', '  whitespace  ', 'another valid', null as any, undefined as any],
      };

      const existingVideo = {
        id: 'video-123',
        title: 'Old Title',
        tags: [],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        format: 'mp4' as const,
        addedAt: new Date(),
      };

      const updatedVideo = {
        ...existingVideo,
        title: 'Test Video',
        tags: ['valid', 'whitespace', 'another valid'],
      };

      mockVideoRepository.findById.mockResolvedValue(existingVideo);
      mockVideoRepository.update.mockResolvedValue(updatedVideo);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(mockVideoRepository.update).toHaveBeenCalledWith('video-123', {
        title: 'Test Video',
        tags: ['valid', 'whitespace', 'another valid'],
        description: undefined,
      });
    });
  });

  describe('Validation errors', () => {
    it('should fail when videoId is missing', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: '',
        title: 'Valid Title',
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

    it('should fail when title is missing', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: '',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Title is required');
      }

      expect(mockVideoRepository.findById).not.toHaveBeenCalled();
    });

    it('should fail when title is only whitespace', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: '   ',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Title is required');
      }
    });

    it('should fail when tags is not an array', async () => {
      // Arrange
      const request = {
        videoId: 'video-123',
        title: 'Valid Title',
        tags: 'invalid-tags',
      } as any;

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Tags must be an array');
      }
    });

    it('should fail when description is not a string', async () => {
      // Arrange
      const request = {
        videoId: 'video-123',
        title: 'Valid Title',
        description: 123,
      } as any;

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Description must be a string');
      }
    });
  });

  describe('Video not found', () => {
    it('should fail when video does not exist', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'nonexistent-video',
        title: 'Valid Title',
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
      expect(mockVideoRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('Repository operation failures', () => {
    it('should fail when repository findById fails', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: 'Valid Title',
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

      expect(mockVideoRepository.update).not.toHaveBeenCalled();
    });

    it('should fail when repository update fails', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: 'Valid Title',
      };

      const existingVideo = {
        id: 'video-123',
        title: 'Old Title',
        tags: [],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        format: 'mp4' as const,
        addedAt: new Date(),
      };

      mockVideoRepository.findById.mockResolvedValue(existingVideo);
      mockVideoRepository.update.mockRejectedValue(new Error('Database write error'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Database write error');
      }

      expect(mockVideoRepository.findById).toHaveBeenCalledWith('video-123');
      expect(mockVideoRepository.update).toHaveBeenCalledWith('video-123', {
        title: 'Valid Title',
        tags: [],
        description: undefined,
      });
    });

    it('should fail when repository update returns null', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: 'Valid Title',
      };

      const existingVideo = {
        id: 'video-123',
        title: 'Old Title',
        tags: [],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        format: 'mp4' as const,
        addedAt: new Date(),
      };

      mockVideoRepository.findById.mockResolvedValue(existingVideo);
      mockVideoRepository.update.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Failed to update video');
      }
    });
  });

  describe('Error handling without logger', () => {
    it('should work correctly without logger dependency', async () => {
      // Arrange
      const depsWithoutLogger = {
        videoRepository: mockVideoRepository,
        // No logger
      };

      const useCaseWithoutLogger = new UpdateVideoUseCase(depsWithoutLogger);

      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: 'Test Title',
      };

      const existingVideo = {
        id: 'video-123',
        title: 'Old Title',
        tags: [],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        format: 'mp4' as const,
        addedAt: new Date(),
      };

      const updatedVideo = {
        ...existingVideo,
        title: 'Test Title',
      };

      mockVideoRepository.findById.mockResolvedValue(existingVideo);
      mockVideoRepository.update.mockResolvedValue(updatedVideo);

      // Act
      const result = await useCaseWithoutLogger.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.video.title).toBe('Test Title');
      }
    });
  });

  describe('Edge cases for data sanitization', () => {
    it('should handle empty description correctly', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: 'Test Title',
        description: '   ',
      };

      const existingVideo = {
        id: 'video-123',
        title: 'Old Title',
        tags: [],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        format: 'mp4' as const,
        addedAt: new Date(),
      };

      const updatedVideo = {
        ...existingVideo,
        title: 'Test Title',
        description: undefined,
      };

      mockVideoRepository.findById.mockResolvedValue(existingVideo);
      mockVideoRepository.update.mockResolvedValue(updatedVideo);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(mockVideoRepository.update).toHaveBeenCalledWith('video-123', {
        title: 'Test Title',
        tags: [],
        description: undefined,
      });
    });

    it('should trim whitespace from title', async () => {
      // Arrange
      const request: UpdateVideoRequest = {
        videoId: 'video-123',
        title: '  Trimmed Title  ',
      };

      const existingVideo = {
        id: 'video-123',
        title: 'Old Title',
        tags: [],
        videoUrl: '/data/videos/video-123/playlist.m3u8',
        thumbnailUrl: '/api/thumbnail/video-123',
        duration: 120,
        format: 'mp4' as const,
        addedAt: new Date(),
      };

      const updatedVideo = {
        ...existingVideo,
        title: 'Trimmed Title',
      };

      mockVideoRepository.findById.mockResolvedValue(existingVideo);
      mockVideoRepository.update.mockResolvedValue(updatedVideo);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(mockVideoRepository.update).toHaveBeenCalledWith('video-123', {
        title: 'Trimmed Title',
        tags: [],
        description: undefined,
      });
    });
  });
});
