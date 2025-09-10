import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AddVideoDependencies, AddVideoRequest } from '~/modules/video/add-video/add-video.types';
import { InternalError, ValidationError } from '~/lib/errors';
import { AddVideoUseCase } from '~/modules/video/add-video/add-video.usecase';

describe('AddVideoUseCase', () => {
  let useCase: AddVideoUseCase;
  let mockDependencies: AddVideoDependencies;
  let mockVideoRepository: any;
  let mockWorkspaceManager: any;
  let mockVideoAnalysis: any;
  let mockVideoTranscoder: any;
  let mockLogger: any;

  beforeEach(() => {
    // Create mock video repository
    mockVideoRepository = {
      create: vi.fn(),
      updateHLSStatus: vi.fn(),
    };

    // Create mock workspace manager
    mockWorkspaceManager = {
      createWorkspace: vi.fn(),
      moveToWorkspace: vi.fn(),
    };

    // Create mock video analysis service
    mockVideoAnalysis = {
      analyze: vi.fn(),
    };

    // Create mock HLS converter
    mockVideoTranscoder = {
      transcode: vi.fn(),
      extractMetadata: vi.fn(),
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
      videoAnalysis: mockVideoAnalysis,
      videoTranscoder: mockVideoTranscoder,
      logger: mockLogger,
    };

    useCase = new AddVideoUseCase(mockDependencies);
  });

  describe('Successful video addition', () => {
    it('should add video successfully with video conversion', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test-video.mp4',
        title: 'Test Video',
        tags: ['test', 'sample'],
        description: 'A test video',
      };

      const mockVideoId = 'video-123';
      const mockVideoInfo = {
        fileSize: 1000000,
        duration: 120,
      };
      const mockWorkspace = { videoId: mockVideoId, rootDir: `/videos/${mockVideoId}` };

      mockWorkspaceManager.createWorkspace.mockResolvedValue(mockWorkspace);
      mockWorkspaceManager.moveToWorkspace.mockResolvedValue({ success: true, destination: `/videos/${mockVideoId}/video.mp4` });
      mockVideoAnalysis.analyze.mockResolvedValue(mockVideoInfo);
      mockVideoRepository.create.mockResolvedValue(undefined);
      mockVideoRepository.updateHLSStatus.mockResolvedValue({});
      mockVideoTranscoder.transcode.mockResolvedValue({ success: true, data: { videoId: mockVideoId, manifestPath: '', thumbnailPath: '', duration: 120 } });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.videoId).toBeDefined();
        expect(result.data.message).toContain('successfully with video conversion');
        expect(result.data.hlsEnabled).toBe(true);
      }

      expect(mockWorkspaceManager.createWorkspace).toHaveBeenCalledWith({ videoId: expect.any(String), temporary: false, cleanupOnError: true });
      expect(mockWorkspaceManager.moveToWorkspace).toHaveBeenCalled();
      expect(mockVideoAnalysis.analyze).toHaveBeenCalled();
      expect(mockVideoRepository.create).toHaveBeenCalled();
      expect(mockVideoTranscoder.transcode).toHaveBeenCalledWith({
        videoId: expect.any(String),
        sourcePath: expect.any(String),
        quality: 'high',
        useGpu: false,
      });
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

      // Should not call external services for validation errors
      expect(mockWorkspaceManager.createWorkspace).not.toHaveBeenCalled();
    });

    it('should fail when title is missing', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test-video.mp4',
        title: '',
        tags: ['test'],
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('title');
      }

      expect(mockWorkspaceManager.createWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('File operation errors', () => {
    it('should handle workspace creation failures', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test-video.mp4',
        title: 'Test Video',
        tags: ['test'],
      };

      mockWorkspaceManager.createWorkspace.mockRejectedValue(new Error('Workspace creation failed'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
      }
    });

    it('should handle file move failures', async () => {
      // Arrange
      const request: AddVideoRequest = {
        filename: 'test-video.mp4',
        title: 'Test Video',
        tags: ['test'],
      };

      const mockWorkspace = { videoId: 'video-123', rootDir: '/videos/video-123' };

      mockWorkspaceManager.createWorkspace.mockResolvedValue(mockWorkspace);
      mockWorkspaceManager.moveToWorkspace.mockResolvedValue({ success: false, error: 'File not found' });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toContain('Failed to move file to workspace');
      }
    });
  });
});
