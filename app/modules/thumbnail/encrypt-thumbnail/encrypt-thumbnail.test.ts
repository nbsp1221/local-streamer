import { describe, expect, it, vi } from 'vitest';
import { ValidationError } from '~/lib/errors';
import type { EncryptThumbnailUseCaseDependencies, EncryptThumbnailUseCaseRequest } from './encrypt-thumbnail.types';
import { EncryptThumbnailUseCase } from './encrypt-thumbnail.usecase';

// Mock dependencies
const createMockDependencies = (): EncryptThumbnailUseCaseDependencies => ({
  thumbnailEncryptionService: {
    encryptThumbnail: vi.fn(),
    decryptThumbnail: vi.fn(),
    hasEncryptedThumbnail: vi.fn(),
    migrateExistingThumbnail: vi.fn(),
  } as any,
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  } as any,
});

describe('EncryptThumbnailUseCase', () => {
  const validRequest: EncryptThumbnailUseCaseRequest = {
    videoId: '12345678-1234-1234-1234-123456789abc',
    thumbnailPath: '/path/to/thumbnail.jpg',
  };

  describe('validation', () => {
    it('should validate successful request', async () => {
      const mockDeps = createMockDependencies();
      mockDeps.thumbnailEncryptionService.encryptThumbnail = vi.fn().mockResolvedValue({
        success: true,
        encryptedPath: '/path/to/thumbnail.enc',
        originalSize: 1000,
        encryptedSize: 1100,
      });

      const useCase = new EncryptThumbnailUseCase(mockDeps);
      const result = await useCase.execute(validRequest);

      expect(result.success).toBe(true);
      expect(mockDeps.thumbnailEncryptionService.encryptThumbnail).toHaveBeenCalledWith({
        videoId: validRequest.videoId,
        thumbnailPath: validRequest.thumbnailPath,
      });
    });

    it('should fail with empty video ID', async () => {
      const mockDeps = createMockDependencies();
      const useCase = new EncryptThumbnailUseCase(mockDeps);

      const invalidRequest = {
        ...validRequest,
        videoId: '',
      };

      const result = await useCase.execute(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Video ID is required');
      }
    });

    it('should fail with invalid UUID format', async () => {
      const mockDeps = createMockDependencies();
      const useCase = new EncryptThumbnailUseCase(mockDeps);

      const invalidRequest = {
        ...validRequest,
        videoId: 'invalid-uuid',
      };

      const result = await useCase.execute(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Invalid video ID format');
      }
    });

    it('should fail with empty thumbnail path', async () => {
      const mockDeps = createMockDependencies();
      const useCase = new EncryptThumbnailUseCase(mockDeps);

      const invalidRequest = {
        ...validRequest,
        thumbnailPath: '',
      };

      const result = await useCase.execute(invalidRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Thumbnail path is required');
      }
    });
  });

  describe('business logic', () => {
    it('should encrypt thumbnail successfully', async () => {
      const mockDeps = createMockDependencies();
      const mockEncryptionResult = {
        success: true,
        encryptedPath: '/data/videos/test-id/thumbnail.enc',
        originalSize: 5000,
        encryptedSize: 5100,
      };

      mockDeps.thumbnailEncryptionService.encryptThumbnail = vi.fn().mockResolvedValue(mockEncryptionResult);

      const useCase = new EncryptThumbnailUseCase(mockDeps);
      const result = await useCase.execute(validRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          videoId: validRequest.videoId,
          encryptedPath: mockEncryptionResult.encryptedPath,
          originalSize: mockEncryptionResult.originalSize,
          encryptedSize: mockEncryptionResult.encryptedSize,
          compressionRatio: mockEncryptionResult.encryptedSize / mockEncryptionResult.originalSize,
        });
      }
    });

    it('should calculate compression ratio correctly', async () => {
      const mockDeps = createMockDependencies();
      const mockEncryptionResult = {
        success: true,
        encryptedPath: '/path/to/thumbnail.enc',
        originalSize: 1000,
        encryptedSize: 1200,
      };

      mockDeps.thumbnailEncryptionService.encryptThumbnail = vi.fn().mockResolvedValue(mockEncryptionResult);

      const useCase = new EncryptThumbnailUseCase(mockDeps);
      const result = await useCase.execute(validRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.compressionRatio).toBe(1.2); // 1200 / 1000
      }
    });

    it('should handle encryption service errors', async () => {
      const mockDeps = createMockDependencies();
      const mockError = new Error('Encryption failed');

      mockDeps.thumbnailEncryptionService.encryptThumbnail = vi.fn().mockRejectedValue(mockError);

      const useCase = new EncryptThumbnailUseCase(mockDeps);
      const result = await useCase.execute(validRequest);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain('Encryption failed');
      }
    });

    it('should log operations correctly', async () => {
      const mockDeps = createMockDependencies();
      const mockEncryptionResult = {
        success: true,
        encryptedPath: '/path/to/thumbnail.enc',
        originalSize: 1000,
        encryptedSize: 1100,
      };

      mockDeps.thumbnailEncryptionService.encryptThumbnail = vi.fn().mockResolvedValue(mockEncryptionResult);

      const useCase = new EncryptThumbnailUseCase(mockDeps);
      await useCase.execute(validRequest);

      expect(mockDeps.logger?.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting thumbnail encryption for video'),
      );
      expect(mockDeps.logger?.info).toHaveBeenCalledWith(
        expect.stringContaining('Thumbnail encryption completed'),
      );
    });
  });

  describe('edge cases', () => {
    it('should handle zero-size files', async () => {
      const mockDeps = createMockDependencies();
      const mockEncryptionResult = {
        success: true,
        encryptedPath: '/path/to/thumbnail.enc',
        originalSize: 0,
        encryptedSize: 16, // Just IV size
      };

      mockDeps.thumbnailEncryptionService.encryptThumbnail = vi.fn().mockResolvedValue(mockEncryptionResult);

      const useCase = new EncryptThumbnailUseCase(mockDeps);
      const result = await useCase.execute(validRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.originalSize).toBe(0);
        expect(result.data.encryptedSize).toBe(16);
      }
    });

    it('should handle very large files', async () => {
      const mockDeps = createMockDependencies();
      const mockEncryptionResult = {
        success: true,
        encryptedPath: '/path/to/thumbnail.enc',
        originalSize: 10485760, // 10MB
        encryptedSize: 10485776, // 10MB + 16 bytes IV
      };

      mockDeps.thumbnailEncryptionService.encryptThumbnail = vi.fn().mockResolvedValue(mockEncryptionResult);

      const useCase = new EncryptThumbnailUseCase(mockDeps);
      const result = await useCase.execute(validRequest);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.compressionRatio).toBeCloseTo(1.000001526, 6); // Very slight increase due to IV
      }
    });
  });
});
