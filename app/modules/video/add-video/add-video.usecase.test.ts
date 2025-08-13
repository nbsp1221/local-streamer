import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AddVideoUseCase } from '~/modules/video/add-video/add-video.usecase';
import type { AddVideoRequest, AddVideoDependencies } from '~/modules/video/add-video/add-video.types';
import { ValidationError, InternalError } from '~/lib/errors';

describe('AddVideoUseCase', () => {
  let useCase: AddVideoUseCase;
  let mockDependencies: AddVideoDependencies;
  let mockVideoRepository: any;
  let mockFileManager: any;
  let mockHlsConverter: any;
  let mockLogger: any;

  beforeEach(() => {
    // Create mock video repository
    mockVideoRepository = {
      create: vi.fn(),
      updateHLSStatus: vi.fn(),
    };

    // Create mock file manager
    mockFileManager = {
      ensureVideosDirectory: vi.fn(),
      moveToLibrary: vi.fn(),
      getVideoInfo: vi.fn(),
      moveTempThumbnailToLibrary: vi.fn(),
    };

    // Create mock HLS converter
    mockHlsConverter = {
      convertVideo: vi.fn(),
    };

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    // Setup dependencies
    mockDependencies = {
      videoRepository: mockVideoRepository,
      fileManager: mockFileManager,
      hlsConverter: mockHlsConverter,
      logger: mockLogger,
    };

    useCase = new AddVideoUseCase(mockDependencies);
  });

  describe('Successful video addition', () => {
    it('should add video successfully with HLS conversion', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test-video.mp4',
        title: 'Test Video',
        tags: ['test', 'sample'],
        description: 'A test video',
      };

      const mockVideoId = 'video-123';
      const mockVideoInfo = {
        duration: 120,
        format: 'mp4' as const,
      };

      mockFileManager.moveToLibrary.mockResolvedValue(mockVideoId);
      mockFileManager.getVideoInfo.mockResolvedValue(mockVideoInfo);
      mockFileManager.moveTempThumbnailToLibrary.mockResolvedValue(false);
      mockVideoRepository.create.mockResolvedValue(undefined);
      mockVideoRepository.updateHLSStatus.mockResolvedValue({});
      mockHlsConverter.convertVideo.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videoId).toBe(mockVideoId);
        expect(result.data.message).toContain('successfully with HLS');
        expect(result.data.hlsEnabled).toBe(true);
      }

      expect(mockFileManager.ensureVideosDirectory).toHaveBeenCalledOnce();
      expect(mockFileManager.moveToLibrary).toHaveBeenCalledWith('test-video.mp4');
      expect(mockFileManager.getVideoInfo).toHaveBeenCalled();
      expect(mockVideoRepository.create).toHaveBeenCalled();
      expect(mockHlsConverter.convertVideo).toHaveBeenCalledWith(mockVideoId, expect.any(String));
      expect(mockVideoRepository.updateHLSStatus).toHaveBeenCalledWith(mockVideoId, true, expect.any(Date));
    });
  });

  describe('Validation errors', () => {
    it('should fail when filename is missing', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: '',
        title: 'Test Video',
        tags: ['test'],
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Filename and title are required');
      }

      expect(mockFileManager.moveToLibrary).not.toHaveBeenCalled();
    });

    it('should fail when title is missing', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test.mp4',
        title: '',
        tags: ['test'],
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Filename and title are required');
      }
    });

    it('should fail when title is only whitespace', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test.mp4',
        title: '   ',
        tags: ['test'],
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Title cannot be empty');
      }
    });
  });

  describe('HLS conversion failure scenarios', () => {
    it('should add video even when HLS conversion fails', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test-video.mp4',
        title: 'Test Video',
        tags: ['test'],
      };

      const mockVideoId = 'video-123';
      const mockVideoInfo = {
        duration: 120,
        format: 'mp4' as const,
      };

      mockFileManager.moveToLibrary.mockResolvedValue(mockVideoId);
      mockFileManager.getVideoInfo.mockResolvedValue(mockVideoInfo);
      mockFileManager.moveTempThumbnailToLibrary.mockResolvedValue(false);
      mockVideoRepository.create.mockResolvedValue(undefined);
      mockVideoRepository.updateHLSStatus.mockResolvedValue({});
      
      // HLS conversion fails
      mockHlsConverter.convertVideo.mockRejectedValue(new Error('FFmpeg failed'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videoId).toBe(mockVideoId);
        expect(result.data.message).toContain('HLS generation failed');
        expect(result.data.hlsEnabled).toBe(false);
      }

      expect(mockVideoRepository.create).toHaveBeenCalled();
      expect(mockVideoRepository.updateHLSStatus).toHaveBeenCalledWith(mockVideoId, false);
    });
  });

  describe('File operation failure scenarios', () => {
    it('should fail when file movement fails', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test-video.mp4',
        title: 'Test Video',
        tags: ['test'],
      };

      mockFileManager.moveToLibrary.mockRejectedValue(new Error('File not found'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('File not found');
      }

      expect(mockVideoRepository.create).not.toHaveBeenCalled();
    });

    it('should fail when video info extraction fails', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test-video.mp4',
        title: 'Test Video',
        tags: ['test'],
      };

      const mockVideoId = 'video-123';
      mockFileManager.moveToLibrary.mockResolvedValue(mockVideoId);
      mockFileManager.getVideoInfo.mockRejectedValue(new Error('Invalid video file'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Invalid video file');
      }

      expect(mockVideoRepository.create).not.toHaveBeenCalled();
    });

    it('should fail when database save fails', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test-video.mp4',
        title: 'Test Video',
        tags: ['test'],
      };

      const mockVideoId = 'video-123';
      const mockVideoInfo = {
        duration: 120,
        format: 'mp4' as const,
      };

      mockFileManager.moveToLibrary.mockResolvedValue(mockVideoId);
      mockFileManager.getVideoInfo.mockResolvedValue(mockVideoInfo);
      mockFileManager.moveTempThumbnailToLibrary.mockResolvedValue(false);
      mockVideoRepository.create.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Database error');
      }
    });
  });

  describe('Tag processing', () => {
    it('should filter and trim tags correctly', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test-video.mp4',
        title: 'Test Video',
        tags: ['  tag1  ', '', '   ', 'tag2', 'TAG3'],
      };

      const mockVideoId = 'video-123';
      const mockVideoInfo = {
        duration: 120,
        format: 'mp4' as const,
      };

      mockFileManager.moveToLibrary.mockResolvedValue(mockVideoId);
      mockFileManager.getVideoInfo.mockResolvedValue(mockVideoInfo);
      mockFileManager.moveTempThumbnailToLibrary.mockResolvedValue(false);
      mockVideoRepository.create.mockResolvedValue(undefined);
      mockVideoRepository.updateHLSStatus.mockResolvedValue({});
      mockHlsConverter.convertVideo.mockResolvedValue(undefined);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);

      const createCall = mockVideoRepository.create.mock.calls[0][0];
      expect(createCall.tags).toEqual(['tag1', 'tag2', 'TAG3']);
    });
  });
});
