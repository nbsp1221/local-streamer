import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingVideo } from '~/types/video';
import { InternalError } from '~/lib/errors';
import type { ScanIncomingDependencies } from './scan-incoming.types';
import { ScanIncomingUseCase } from './scan-incoming.usecase';

// Mock dependencies
const mockFileManager = {
  ensureUploadsDirectory: vi.fn(),
  scanIncomingFiles: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const deps: ScanIncomingDependencies = {
  fileManager: mockFileManager,
  logger: mockLogger,
};

describe('ScanIncomingUseCase', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully scan and return empty array when no files found', async () => {
    // Arrange
    const useCase = new ScanIncomingUseCase(deps);
    mockFileManager.ensureUploadsDirectory.mockResolvedValue(undefined);
    mockFileManager.scanIncomingFiles.mockResolvedValue([]);

    // Act
    const result = await useCase.execute({});

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files).toEqual([]);
      expect(result.data.count).toBe(0);
    }
    expect(mockFileManager.ensureUploadsDirectory).toHaveBeenCalledOnce();
    expect(mockFileManager.scanIncomingFiles).toHaveBeenCalledOnce();
    expect(mockLogger.info).toHaveBeenCalledWith('Starting to scan uploads directory for video files');
    expect(mockLogger.info).toHaveBeenCalledWith('Uploads directory verified');
    expect(mockLogger.info).toHaveBeenCalledWith('No video files found in uploads directory');
  });

  it('should successfully scan and return files when found', async () => {
    // Arrange
    const useCase = new ScanIncomingUseCase(deps);
    const mockFiles: PendingVideo[] = [
      {
        id: '1',
        filename: 'video1.mp4',
        size: 1024000,
        type: 'video/mp4',
        thumbnailUrl: '/api/thumbnail-preview/video1.jpg',
      },
      {
        id: '2',
        filename: 'video2.mkv',
        size: 2048000,
        type: 'video/x-matroska',
        thumbnailUrl: '/api/thumbnail-preview/video2.jpg',
      },
    ];

    mockFileManager.ensureUploadsDirectory.mockResolvedValue(undefined);
    mockFileManager.scanIncomingFiles.mockResolvedValue(mockFiles);

    // Act
    const result = await useCase.execute({});

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files).toEqual(mockFiles);
      expect(result.data.count).toBe(2);
    }
    expect(mockFileManager.ensureUploadsDirectory).toHaveBeenCalledOnce();
    expect(mockFileManager.scanIncomingFiles).toHaveBeenCalledOnce();
    expect(mockLogger.info).toHaveBeenCalledWith('Starting to scan uploads directory for video files');
    expect(mockLogger.info).toHaveBeenCalledWith('Uploads directory verified');
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Found 2 video file(s) in uploads directory',
      expect.objectContaining({
        count: 2,
        files: expect.arrayContaining([
          expect.objectContaining({
            filename: 'video1.mp4',
            size: 1024000,
            type: 'video/mp4',
          }),
          expect.objectContaining({
            filename: 'video2.mkv',
            size: 2048000,
            type: 'video/x-matroska',
          }),
        ]),
      }),
    );
  });

  it('should handle error when ensuring directory fails', async () => {
    // Arrange
    const useCase = new ScanIncomingUseCase(deps);
    const error = new Error('Permission denied');
    mockFileManager.ensureUploadsDirectory.mockRejectedValue(error);

    // Act
    const result = await useCase.execute({});

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InternalError);
      expect(result.error.message).toBe('Failed to scan uploads files');
    }
    expect(mockFileManager.ensureUploadsDirectory).toHaveBeenCalledOnce();
    expect(mockFileManager.scanIncomingFiles).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to scan uploads files', error);
  });

  it('should handle error when scanning files fails', async () => {
    // Arrange
    const useCase = new ScanIncomingUseCase(deps);
    const error = new Error('Read error');
    mockFileManager.ensureUploadsDirectory.mockResolvedValue(undefined);
    mockFileManager.scanIncomingFiles.mockRejectedValue(error);

    // Act
    const result = await useCase.execute({});

    // Assert
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InternalError);
      expect(result.error.message).toBe('Failed to scan uploads files');
    }
    expect(mockFileManager.ensureUploadsDirectory).toHaveBeenCalledOnce();
    expect(mockFileManager.scanIncomingFiles).toHaveBeenCalledOnce();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to scan uploads files', error);
  });

  it('should handle single file scan correctly', async () => {
    // Arrange
    const useCase = new ScanIncomingUseCase(deps);
    const mockFiles: PendingVideo[] = [
      {
        id: '1',
        filename: 'single-video.mp4',
        size: 5000000,
        type: 'video/mp4',
      },
    ];

    mockFileManager.ensureUploadsDirectory.mockResolvedValue(undefined);
    mockFileManager.scanIncomingFiles.mockResolvedValue(mockFiles);

    // Act
    const result = await useCase.execute({});

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files).toHaveLength(1);
      expect(result.data.count).toBe(1);
      expect(result.data.files[0]).toEqual(mockFiles[0]);
    }
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Found 1 video file(s) in uploads directory',
      expect.any(Object),
    );
  });
});
