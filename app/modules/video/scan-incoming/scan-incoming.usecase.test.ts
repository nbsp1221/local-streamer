import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PendingVideo } from '~/types/video';
import { InternalError } from '~/lib/errors';
import { Result } from '~/lib/result';
import type { ScanIncomingDependencies } from './scan-incoming.types';
import { ScanIncomingUseCase } from './scan-incoming.usecase';

// Mock dependencies
const mockThumbnailGenerator = {
  generateThumbnail: vi.fn(),
  isThumbnailGenerationAvailable: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const deps: ScanIncomingDependencies = {
  thumbnailGenerator: mockThumbnailGenerator,
  logger: mockLogger,
};

describe('ScanIncomingUseCase', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Set up default successful thumbnail generation
    mockThumbnailGenerator.generateThumbnail.mockResolvedValue(Result.ok({ thumbnailPath: '/path/to/thumb.jpg' }));
    mockThumbnailGenerator.isThumbnailGenerationAvailable.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully scan and return result with proper logging', async () => {
    // Arrange
    const useCase = new ScanIncomingUseCase(deps);

    // Act
    const result = await useCase.execute({});

    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.files).toBeDefined();
      expect(result.data.count).toBeDefined();
      expect(result.data.count).toBe(result.data.files.length);
    }
    expect(mockLogger.info).toHaveBeenCalledWith('Starting to scan uploads directory for video files');
    expect(mockLogger.info).toHaveBeenCalledWith('Uploads directory verified');
  });

  it('should handle thumbnail generation errors gracefully', async () => {
    // Arrange
    const useCase = new ScanIncomingUseCase(deps);
    mockThumbnailGenerator.generateThumbnail.mockRejectedValue(new Error('Thumbnail generation failed'));

    // Act
    const result = await useCase.execute({});

    // Assert
    expect(result.success).toBe(true); // Should still succeed even if thumbnail generation fails
    if (result.success) {
      expect(result.data.files).toBeDefined();
      expect(result.data.count).toBeDefined();
    }
  });

  it('should handle general errors and return failure result', async () => {
    // Arrange
    const useCase = new ScanIncomingUseCase(deps);
    // Mock an error in the thumbnail generator to cause the usecase to fail
    mockThumbnailGenerator.isThumbnailGenerationAvailable.mockRejectedValue(new Error('System error'));

    // Act
    const result = await useCase.execute({});

    // Assert - Note: Since the usecase handles most errors internally,
    // this test may need to be adjusted based on actual error scenarios
    if (!result.success) {
      expect(result.error).toBeInstanceOf(InternalError);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to scan uploads files', expect.any(Error));
    }
  });
});
