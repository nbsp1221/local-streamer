import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InternalError, NotFoundError, UnauthorizedError, ValidationError } from '~/lib/errors';
import type { ClearKeyDependencies, ClearKeyRequest } from './clear-key.types';
import { ClearKeyUseCase } from './clear-key.usecase';

describe('ClearKeyUseCase', () => {
  let mockJwtValidator: any;
  let mockKeyManager: any;
  let mockKeyUtils: any;
  let mockLogger: any;
  let dependencies: ClearKeyDependencies;
  let useCase: ClearKeyUseCase;

  beforeEach(() => {
    mockJwtValidator = {
      validateVideoRequest: vi.fn(),
    };

    mockKeyManager = {
      hasVideoKey: vi.fn(),
      getVideoKey: vi.fn(),
    };

    mockKeyUtils = {
      generateKeyId: vi.fn(),
      hexToBase64Url: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    dependencies = {
      jwtValidator: mockJwtValidator,
      keyManager: mockKeyManager,
      keyUtils: mockKeyUtils,
      logger: mockLogger,
    };

    useCase = new ClearKeyUseCase(dependencies);
  });

  describe('Success scenarios', () => {
    it('should generate clear key response successfully', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'test-video-123',
        request: new Request('http://localhost:3000/videos/test-video-123/clearkey'),
      };

      const mockKey = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123' },
      });
      mockKeyManager.hasVideoKey.mockResolvedValue(true);
      mockKeyManager.getVideoKey.mockResolvedValue(mockKey);
      mockKeyUtils.generateKeyId.mockReturnValue('generated-key-id');
      mockKeyUtils.hexToBase64Url.mockImplementation((hex: string) => Buffer.from(hex, 'hex').toString('base64url'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.clearKeyResponse).toEqual({
          keys: [
            {
              kty: 'oct',
              kid: expect.any(String),
              k: expect.any(String),
            },
          ],
          type: 'temporary',
        });
        expect(result.data.headers).toMatchObject({
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        });
      }

      // Verify security logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Clear Key license delivered for video: test-video-123',
        {
          videoId: 'test-video-123',
          userId: 'user-123',
          keyId: 'generated-key-id',
        },
      );

      // Verify all dependencies called
      expect(mockJwtValidator.validateVideoRequest).toHaveBeenCalledWith(request.request, 'test-video-123');
      expect(mockKeyManager.hasVideoKey).toHaveBeenCalledWith('test-video-123');
      expect(mockKeyManager.getVideoKey).toHaveBeenCalledWith('test-video-123');
      expect(mockKeyUtils.generateKeyId).toHaveBeenCalledWith('test-video-123');
    });

    it('should handle unknown user ID gracefully', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'test-video-456',
        request: new Request('http://localhost:3000/videos/test-video-456/clearkey'),
      };

      const mockKey = Buffer.from('fedcba9876543210fedcba9876543210', 'hex');

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        // No payload or userId
      });
      mockKeyManager.hasVideoKey.mockResolvedValue(true);
      mockKeyManager.getVideoKey.mockResolvedValue(mockKey);
      mockKeyUtils.generateKeyId.mockReturnValue('key-id-456');
      mockKeyUtils.hexToBase64Url.mockImplementation((hex: string) => Buffer.from(hex, 'hex').toString('base64url'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Clear Key license delivered for video: test-video-456',
        {
          videoId: 'test-video-456',
          userId: 'unknown',
          keyId: 'key-id-456',
        },
      );
    });
  });

  describe('Validation errors', () => {
    it('should fail when video ID is empty', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: '',
        request: new Request('http://localhost:3000/videos//clearkey'),
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
      expect(mockKeyManager.hasVideoKey).not.toHaveBeenCalled();
    });

    it('should fail when video ID is whitespace only', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: '   ',
        request: new Request('http://localhost:3000/videos/   /clearkey'),
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

    it('should fail when request object is missing', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'valid-video-id',
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

  describe('Authentication failures', () => {
    it('should fail when JWT token validation fails', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'protected-video',
        request: new Request('http://localhost:3000/videos/protected-video/clearkey'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: false,
        error: 'Invalid token signature',
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
        expect(result.error.message).toBe('Invalid token signature');
      }

      // Verify security warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Clear Key license access denied for protected-video',
        {
          error: 'Invalid token signature',
          videoId: 'protected-video',
        },
      );

      // Verify key manager not called for security
      expect(mockKeyManager.hasVideoKey).not.toHaveBeenCalled();
      expect(mockKeyManager.getVideoKey).not.toHaveBeenCalled();
    });

    it('should fail when JWT token validation fails without specific error', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'another-video',
        request: new Request('http://localhost:3000/videos/another-video/clearkey'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: false,
        // No error message provided
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

  describe('Key not found scenarios', () => {
    it('should fail when encryption key does not exist', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'missing-key-video',
        request: new Request('http://localhost:3000/videos/missing-key-video/clearkey'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-789' },
      });
      mockKeyManager.hasVideoKey.mockResolvedValue(false);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(NotFoundError);
        expect(result.error.message).toBe('Encryption key not found');
      }

      // Verify warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith('Encryption key not found for video missing-key-video');

      // Verify getVideoKey not called when key doesn't exist
      expect(mockKeyManager.getVideoKey).not.toHaveBeenCalled();
    });
  });

  describe('Repository errors', () => {
    it('should handle JWT validator errors gracefully', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'error-video',
        request: new Request('http://localhost:3000/videos/error-video/clearkey'),
      };

      mockJwtValidator.validateVideoRequest.mockRejectedValue(new Error('JWT validation service unavailable'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toBe('Clear Key license access denied');
      }

      // Verify error logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Clear Key UseCase failed with unexpected error',
        expect.any(Error),
      );
    });

    it('should handle key manager hasVideoKey errors', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'key-manager-error',
        request: new Request('http://localhost:3000/videos/key-manager-error/clearkey'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-error' },
      });
      mockKeyManager.hasVideoKey.mockRejectedValue(new Error('Key storage unavailable'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toBe('Clear Key license access denied');
      }
    });

    it('should handle key manager getVideoKey errors', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'get-key-error',
        request: new Request('http://localhost:3000/videos/get-key-error/clearkey'),
      };

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-get-error' },
      });
      mockKeyManager.hasVideoKey.mockResolvedValue(true);
      mockKeyManager.getVideoKey.mockRejectedValue(new Error('Cannot retrieve encryption key'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toBe('Clear Key license access denied');
      }
    });
  });

  describe('Utility errors', () => {
    it('should handle key utility errors gracefully', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'utility-error-video',
        request: new Request('http://localhost:3000/videos/utility-error-video/clearkey'),
      };

      const mockKey = Buffer.from('abcdef1234567890abcdef1234567890', 'hex');

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-util-error' },
      });
      mockKeyManager.hasVideoKey.mockResolvedValue(true);
      mockKeyManager.getVideoKey.mockResolvedValue(mockKey);
      mockKeyUtils.generateKeyId.mockImplementation(() => {
        throw new Error('Key ID generation failed');
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toBe('Clear Key license access denied');
      }
    });

    it('should handle base64url conversion errors', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'base64-error-video',
        request: new Request('http://localhost:3000/videos/base64-error-video/clearkey'),
      };

      const mockKey = Buffer.from('1234567890abcdef1234567890abcdef', 'hex');

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'user-base64-error' },
      });
      mockKeyManager.hasVideoKey.mockResolvedValue(true);
      mockKeyManager.getVideoKey.mockResolvedValue(mockKey);
      mockKeyUtils.generateKeyId.mockReturnValue('valid-key-id');
      mockKeyUtils.hexToBase64Url.mockImplementation(() => {
        throw new Error('Base64URL conversion failed');
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toBe('Clear Key license access denied');
      }
    });
  });

  describe('Security headers', () => {
    it('should include all required security headers', async () => {
      // Arrange
      const request: ClearKeyRequest = {
        videoId: 'security-test-video',
        request: new Request('http://localhost:3000/videos/security-test-video/clearkey'),
      };

      const mockKey = Buffer.from('securitytest1234567890abcdef123456', 'hex');

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'security-user' },
      });
      mockKeyManager.hasVideoKey.mockResolvedValue(true);
      mockKeyManager.getVideoKey.mockResolvedValue(mockKey);
      mockKeyUtils.generateKeyId.mockReturnValue('security-key-id');
      mockKeyUtils.hexToBase64Url.mockImplementation((hex: string) => Buffer.from(hex, 'hex').toString('base64url'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        const headers = result.data.headers;

        // Critical security headers
        expect(headers['Cache-Control']).toBe('no-cache, no-store, must-revalidate');
        expect(headers['Pragma']).toBe('no-cache');
        expect(headers['Expires']).toBe('0');

        // CORS headers for EME
        expect(headers['Access-Control-Allow-Origin']).toBe('*');
        expect(headers['Access-Control-Allow-Credentials']).toBe('false');
        expect(headers['Access-Control-Allow-Methods']).toBe('GET, POST');
        expect(headers['Access-Control-Allow-Headers']).toBe('Content-Type, Authorization, Cookie');

        // Additional security headers
        expect(headers['X-Content-Type-Options']).toBe('nosniff');
        expect(headers['X-Frame-Options']).toBe('DENY');
        expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
      }
    });
  });

  describe('Edge cases', () => {
    it('should work without logger dependency', async () => {
      // Arrange
      const depsWithoutLogger: ClearKeyDependencies = {
        jwtValidator: mockJwtValidator,
        keyManager: mockKeyManager,
        keyUtils: mockKeyUtils,
        // No logger provided
      };
      const useCaseWithoutLogger = new ClearKeyUseCase(depsWithoutLogger);

      const request: ClearKeyRequest = {
        videoId: 'no-logger-video',
        request: new Request('http://localhost:3000/videos/no-logger-video/clearkey'),
      };

      const mockKey = Buffer.from('nologger1234567890abcdef1234567890', 'hex');

      mockJwtValidator.validateVideoRequest.mockResolvedValue({
        valid: true,
        payload: { userId: 'no-logger-user' },
      });
      mockKeyManager.hasVideoKey.mockResolvedValue(true);
      mockKeyManager.getVideoKey.mockResolvedValue(mockKey);
      mockKeyUtils.generateKeyId.mockReturnValue('no-logger-key-id');
      mockKeyUtils.hexToBase64Url.mockImplementation((hex: string) => Buffer.from(hex, 'hex').toString('base64url'));

      // Act & Assert - Should not throw error
      const result = await useCaseWithoutLogger.execute(request);
      expect(result.success).toBe(true);
    });
  });
});
