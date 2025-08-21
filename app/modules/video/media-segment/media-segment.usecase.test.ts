import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InternalError, NotFoundError, UnauthorizedError, ValidationError } from '~/lib/errors';
import type { MediaSegmentDependencies, MediaSegmentRequest } from './media-segment.types';
import { MediaSegmentUseCase } from './media-segment.usecase';

describe('MediaSegmentUseCase', () => {
  let mockJwtValidator: any;
  let mockFileSystem: any;
  let mockDashUtils: any;
  let mockPathResolver: any;
  let mockLogger: any;
  let dependencies: MediaSegmentDependencies;
  let useCase: MediaSegmentUseCase;

  beforeEach(() => {
    mockJwtValidator = {
      validateVideoRequest: vi.fn(),
    };

    mockFileSystem = {
      stat: vi.fn(),
      exists: vi.fn(),
      createReadStream: vi.fn(),
    };

    mockDashUtils = {
      isValidDashSegmentName: vi.fn(),
      getDashContentType: vi.fn(),
      getDashSegmentHeaders: vi.fn(),
      handleDashRangeRequest: vi.fn(),
    };

    mockPathResolver = {
      getVideoSegmentPath: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    dependencies = {
      jwtValidator: mockJwtValidator,
      fileSystem: mockFileSystem,
      dashUtils: mockDashUtils,
      pathResolver: mockPathResolver,
      logger: mockLogger,
    };

    useCase = new MediaSegmentUseCase(dependencies);
  });

  describe('Success scenarios', () => {
    it('should serve video segment successfully', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'test-video-123',
        filename: 'segment-001.m4s',
        mediaType: 'video',
        request: new Request('http://localhost:3000/videos/test-video-123/video/segment-001.m4s'),
      };

      const mockStream = new ReadableStream();
      const mockStats = { size: 1024000, mtime: new Date() };
      const mockHeaders = { 'Content-Type': 'video/mp4', 'Content-Length': '1024000' };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123' },
      });
      mockDashUtils.isValidDashSegmentName.mockReturnValue(true);
      mockPathResolver.getVideoSegmentPath.mockReturnValue('/data/videos/test-video-123/video/segment-001.m4s');
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.stat.mockResolvedValue(mockStats);
      mockDashUtils.getDashContentType.mockReturnValue('video/mp4');
      mockFileSystem.createReadStream.mockReturnValue(mockStream);
      mockDashUtils.getDashSegmentHeaders.mockReturnValue(mockHeaders);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stream).toBe(mockStream);
        expect(result.data.headers).toBe(mockHeaders);
        expect(result.data.isRangeResponse).toBeUndefined();
      }

      // Verify all dependencies called correctly
      expect(mockJwtValidator.validateVideoRequest).toHaveBeenCalledWith(request.request, 'test-video-123');
      expect(mockDashUtils.isValidDashSegmentName).toHaveBeenCalledWith('segment-001.m4s');
      expect(mockPathResolver.getVideoSegmentPath).toHaveBeenCalledWith('test-video-123', 'video', 'segment-001.m4s');
      expect(mockFileSystem.exists).toHaveBeenCalledWith('/data/videos/test-video-123/video/segment-001.m4s');
      expect(mockDashUtils.getDashContentType).toHaveBeenCalledWith('segment-001.m4s', 'video');
      expect(mockLogger.info).toHaveBeenCalledWith('video segment served', {
        videoId: 'test-video-123',
        filename: 'segment-001.m4s',
        sizeKB: 1000,
      });
    });

    it('should serve audio segment successfully', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'test-video-456',
        filename: 'init.mp4',
        mediaType: 'audio',
        request: new Request('http://localhost:3000/videos/test-video-456/audio/init.mp4'),
      };

      const mockStream = new ReadableStream();
      const mockStats = { size: 512000, mtime: new Date() };
      const mockHeaders = { 'Content-Type': 'audio/mp4', 'Content-Length': '512000' };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-456' },
      });
      mockDashUtils.isValidDashSegmentName.mockReturnValue(true);
      mockPathResolver.getVideoSegmentPath.mockReturnValue('/data/videos/test-video-456/audio/init.mp4');
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.stat.mockResolvedValue(mockStats);
      mockDashUtils.getDashContentType.mockReturnValue('audio/mp4');
      mockFileSystem.createReadStream.mockReturnValue(mockStream);
      mockDashUtils.getDashSegmentHeaders.mockReturnValue(mockHeaders);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.stream).toBe(mockStream);
        expect(result.data.headers).toBe(mockHeaders);
      }

      expect(mockPathResolver.getVideoSegmentPath).toHaveBeenCalledWith('test-video-456', 'audio', 'init.mp4');
      expect(mockDashUtils.getDashContentType).toHaveBeenCalledWith('init.mp4', 'audio');
      expect(mockLogger.info).toHaveBeenCalledWith('audio segment served', {
        videoId: 'test-video-456',
        filename: 'init.mp4',
        sizeKB: 500,
      });
    });

    it('should handle range requests successfully', async () => {
      // Arrange
      const requestWithRange = new Request('http://localhost:3000/videos/test-video-789/video/segment-002.m4s', {
        headers: { Range: 'bytes=0-1023' },
      });

      const request: MediaSegmentRequest = {
        videoId: 'test-video-789',
        filename: 'segment-002.m4s',
        mediaType: 'video',
        request: requestWithRange,
      };

      const mockStats = { size: 2048000, mtime: new Date() };
      const mockRangeResponse = new Response('partial content', {
        status: 206,
        headers: new Headers({
          'Content-Type': 'video/mp4',
          'Content-Range': 'bytes 0-1023/2048000',
          'Content-Length': '1024',
        }),
      });

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-789' },
      });
      mockDashUtils.isValidDashSegmentName.mockReturnValue(true);
      mockPathResolver.getVideoSegmentPath.mockReturnValue('/data/videos/test-video-789/video/segment-002.m4s');
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.stat.mockResolvedValue(mockStats);
      mockDashUtils.getDashContentType.mockReturnValue('video/mp4');
      mockDashUtils.handleDashRangeRequest.mockReturnValue(mockRangeResponse);

      // Act
      const result = await useCase.execute(request);

      // Assert
      if (!result.success) {
        console.error('Range request test failed:', result.error);
      }
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isRangeResponse).toBe(true);
        expect(result.data.statusCode).toBe(206);
        expect(result.data.headers['content-range']).toBe('bytes 0-1023/2048000');
      }

      expect(mockDashUtils.handleDashRangeRequest).toHaveBeenCalledWith(
        '/data/videos/test-video-789/video/segment-002.m4s',
        'bytes=0-1023',
        2048000,
        'video/mp4',
      );
      expect(mockLogger.info).toHaveBeenCalledWith('video segment served (range)', {
        videoId: 'test-video-789',
        filename: 'segment-002.m4s',
        sizeKB: 2000,
        range: 'bytes=0-1023',
      });
    });
  });

  describe('Validation errors', () => {
    it('should fail when video ID is empty', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: '',
        filename: 'segment-001.m4s',
        mediaType: 'video',
        request: new Request('http://localhost:3000/videos//video/segment-001.m4s'),
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Video ID is required');
      }

      // Verify no dependencies called
      expect(mockJwtValidator.validateVideoRequest).not.toHaveBeenCalled();
    });

    it('should fail when filename is empty', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'test-video-123',
        filename: '',
        mediaType: 'video',
        request: new Request('http://localhost:3000/videos/test-video-123/video/'),
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Filename is required');
      }
    });

    it('should fail when media type is invalid', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'test-video-123',
        filename: 'segment-001.m4s',
        mediaType: 'invalid' as any,
        request: new Request('http://localhost:3000/videos/test-video-123/invalid/segment-001.m4s'),
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Media type must be audio or video');
      }
    });

    it('should fail when request object is missing', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'test-video-123',
        filename: 'segment-001.m4s',
        mediaType: 'video',
        request: null as any,
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Request object is required');
      }
    });
  });

  describe('JWT validation failures', () => {
    it('should fail when JWT token validation fails', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'protected-video',
        filename: 'segment-001.m4s',
        mediaType: 'video',
        request: new Request('http://localhost:3000/videos/protected-video/video/segment-001.m4s'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: false,
        error: 'Token expired',
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
        expect(result.error.message).toBe('Token expired');
      }

      // Verify security warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith('video segment access denied', {
        videoId: 'protected-video',
        filename: 'segment-001.m4s',
        error: 'Token expired',
      });

      // Verify no further processing
      expect(mockDashUtils.isValidDashSegmentName).not.toHaveBeenCalled();
    });

    it('should fail when JWT token validation fails without specific error', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'another-video',
        filename: 'init.mp4',
        mediaType: 'audio',
        request: new Request('http://localhost:3000/videos/another-video/audio/init.mp4'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: false,
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
        expect(result.error.message).toBe('Token validation failed');
      }
    });
  });

  describe('DASH segment validation failures', () => {
    it('should fail when segment filename is invalid', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'test-video-123',
        filename: 'invalid-file.txt',
        mediaType: 'video',
        request: new Request('http://localhost:3000/videos/test-video-123/video/invalid-file.txt'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123' },
      });
      mockDashUtils.isValidDashSegmentName.mockReturnValue(false);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Invalid video segment name');
      }

      // Verify path resolver not called when segment name is invalid
      expect(mockPathResolver.getVideoSegmentPath).not.toHaveBeenCalled();
    });
  });

  describe('File not found scenarios', () => {
    it('should fail when segment file does not exist', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'missing-video',
        filename: 'segment-999.m4s',
        mediaType: 'video',
        request: new Request('http://localhost:3000/videos/missing-video/video/segment-999.m4s'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123' },
      });
      mockDashUtils.isValidDashSegmentName.mockReturnValue(true);
      mockPathResolver.getVideoSegmentPath.mockReturnValue('/data/videos/missing-video/video/segment-999.m4s');
      mockFileSystem.exists.mockResolvedValue(false);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toBe('video segment not found');
      }

      // Verify stat not called when file doesn't exist
      expect(mockFileSystem.stat).not.toHaveBeenCalled();
    });
  });

  describe('File system errors', () => {
    it('should handle file exists check errors', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'fs-error-video',
        filename: 'segment-001.m4s',
        mediaType: 'video',
        request: new Request('http://localhost:3000/videos/fs-error-video/video/segment-001.m4s'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123' },
      });
      mockDashUtils.isValidDashSegmentName.mockReturnValue(true);
      mockPathResolver.getVideoSegmentPath.mockReturnValue('/data/videos/fs-error-video/video/segment-001.m4s');
      mockFileSystem.exists.mockRejectedValue(new Error('File system error'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toBe('Failed to load video segment');
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Media Segment UseCase failed with unexpected error',
        expect.any(Error),
      );
    });

    it('should handle file stat errors', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: 'stat-error-video',
        filename: 'segment-001.m4s',
        mediaType: 'video',
        request: new Request('http://localhost:3000/videos/stat-error-video/video/segment-001.m4s'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123' },
      });
      mockDashUtils.isValidDashSegmentName.mockReturnValue(true);
      mockPathResolver.getVideoSegmentPath.mockReturnValue('/data/videos/stat-error-video/video/segment-001.m4s');
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.stat.mockRejectedValue(new Error('Cannot get file stats'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toBe('Failed to load video segment');
      }
    });
  });

  describe('Range request errors', () => {
    it('should handle range request processing errors', async () => {
      // Arrange
      const requestWithRange = new Request('http://localhost:3000/videos/range-error/video/segment-001.m4s', {
        headers: { Range: 'bytes=invalid-range' },
      });

      const request: MediaSegmentRequest = {
        videoId: 'range-error-video',
        filename: 'segment-001.m4s',
        mediaType: 'video',
        request: requestWithRange,
      };

      const mockStats = { size: 1024000, mtime: new Date() };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123' },
      });
      mockDashUtils.isValidDashSegmentName.mockReturnValue(true);
      mockPathResolver.getVideoSegmentPath.mockReturnValue('/data/videos/range-error-video/video/segment-001.m4s');
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.stat.mockResolvedValue(mockStats);
      mockDashUtils.getDashContentType.mockReturnValue('video/mp4');
      mockDashUtils.handleDashRangeRequest.mockRejectedValue(new Error('Invalid range format'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toBe('Failed to load video segment');
      }
    });
  });

  describe('Edge cases', () => {
    it('should work without logger dependency', async () => {
      // Arrange
      const depsWithoutLogger: MediaSegmentDependencies = {
        jwtValidator: mockJwtValidator,
        fileSystem: mockFileSystem,
        dashUtils: mockDashUtils,
        pathResolver: mockPathResolver,
        // No logger provided
      };
      const useCaseWithoutLogger = new MediaSegmentUseCase(depsWithoutLogger);

      const request: MediaSegmentRequest = {
        videoId: 'no-logger-video',
        filename: 'segment-001.m4s',
        mediaType: 'video',
        request: new Request('http://localhost:3000/videos/no-logger-video/video/segment-001.m4s'),
      };

      const mockStream = new ReadableStream();
      const mockStats = { size: 1024000, mtime: new Date() };
      const mockHeaders = { 'Content-Type': 'video/mp4', 'Content-Length': '1024000' };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123' },
      });
      mockDashUtils.isValidDashSegmentName.mockReturnValue(true);
      mockPathResolver.getVideoSegmentPath.mockReturnValue('/data/videos/no-logger-video/video/segment-001.m4s');
      mockFileSystem.exists.mockResolvedValue(true);
      mockFileSystem.stat.mockResolvedValue(mockStats);
      mockDashUtils.getDashContentType.mockReturnValue('video/mp4');
      mockFileSystem.createReadStream.mockReturnValue(mockStream);
      mockDashUtils.getDashSegmentHeaders.mockReturnValue(mockHeaders);

      // Act & Assert - Should not throw error
      const result = await useCaseWithoutLogger.execute(request);
      expect(result.success).toBe(true);
    });

    it('should handle whitespace in video ID and filename', async () => {
      // Arrange
      const request: MediaSegmentRequest = {
        videoId: '   ',
        filename: '   ',
        mediaType: 'video',
        request: new Request('http://localhost:3000/videos/   /video/   '),
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Video ID is required');
      }
    });

    it('should handle both audio and video media types correctly', async () => {
      // Test audio media type error messages
      const audioRequest: MediaSegmentRequest = {
        videoId: 'test-video',
        filename: 'invalid-file.txt',
        mediaType: 'audio',
        request: new Request('http://localhost:3000/videos/test-video/audio/invalid-file.txt'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123' },
      });
      mockDashUtils.isValidDashSegmentName.mockReturnValue(false);

      const result = await useCase.execute(audioRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Invalid audio segment name');
      }
    });
  });
});
