import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '~/lib/errors';
import type { GenerateVideoTokenDependencies, GenerateVideoTokenRequest } from './generate-token.types';
import { GenerateVideoTokenUseCase } from './generate-token.usecase';

describe('GenerateVideoTokenUseCase', () => {
  let mockJwt: any;
  let mockConfig: any;
  let mockLogger: any;
  let dependencies: GenerateVideoTokenDependencies;
  let useCase: GenerateVideoTokenUseCase;

  beforeEach(() => {
    mockJwt = {
      sign: vi.fn(),
    };

    mockConfig = {
      jwtSecret: 'test-secret',
      jwtIssuer: 'local-streamer',
      jwtAudience: 'video-streaming',
      jwtExpiry: '15m',
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    dependencies = {
      jwt: mockJwt,
      config: mockConfig,
      logger: mockLogger,
    };

    useCase = new GenerateVideoTokenUseCase(dependencies);
  });

  describe('Success scenarios', () => {
    it('should generate token successfully with minimal required fields', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: 'test-user-456',
      };

      const expectedToken = 'generated-jwt-token';
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect((result as any).data).toEqual({
        token: expectedToken,
      });

      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          videoId: 'test-video-123',
          userId: 'test-user-456',
        },
        'test-secret',
        {
          expiresIn: '15m',
          issuer: 'local-streamer',
          audience: 'video-streaming',
        },
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Generated video token for video test-video-123, user test-user-456',
      );
    });

    it('should generate token successfully with IP address', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: 'test-user-456',
        ipAddress: '192.168.1.1',
      };

      const expectedToken = 'generated-jwt-token-with-ip';
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect((result as any).data).toEqual({
        token: expectedToken,
      });

      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          videoId: 'test-video-123',
          userId: 'test-user-456',
          ip: '192.168.1.1',
        },
        'test-secret',
        {
          expiresIn: '15m',
          issuer: 'local-streamer',
          audience: 'video-streaming',
        },
      );
    });

    it('should generate token successfully with User-Agent', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: 'test-user-456',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const expectedToken = 'generated-jwt-token-with-ua';
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          videoId: 'test-video-123',
          userId: 'test-user-456',
          userAgent: 'Mozilla/5.0 Test Browser',
        },
        'test-secret',
        {
          expiresIn: '15m',
          issuer: 'local-streamer',
          audience: 'video-streaming',
        },
      );
    });

    it('should generate token successfully with all optional fields', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: 'test-user-456',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      const expectedToken = 'generated-jwt-token-complete';
      mockJwt.sign.mockReturnValue(expectedToken);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        {
          videoId: 'test-video-123',
          userId: 'test-user-456',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0 Test Browser',
        },
        'test-secret',
        {
          expiresIn: '15m',
          issuer: 'local-streamer',
          audience: 'video-streaming',
        },
      );
    });

    it('should not include IP in payload when not provided', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: 'test-user-456',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      mockJwt.sign.mockReturnValue('token');

      // Act
      await useCase.execute(request);

      // Assert
      const calledPayload = mockJwt.sign.mock.calls[0][0];
      expect(calledPayload).not.toHaveProperty('ip');
      expect(calledPayload).toHaveProperty('userAgent');
    });

    it('should not include userAgent in payload when not provided', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: 'test-user-456',
        ipAddress: '192.168.1.1',
      };

      mockJwt.sign.mockReturnValue('token');

      // Act
      await useCase.execute(request);

      // Assert
      const calledPayload = mockJwt.sign.mock.calls[0][0];
      expect(calledPayload).toHaveProperty('ip');
      expect(calledPayload).not.toHaveProperty('userAgent');
    });
  });

  describe('Validation errors', () => {
    it('should fail when videoId is empty', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: '',
        userId: 'test-user-456',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ValidationError);
      expect((result as any).error.message).toBe('Video ID is required');
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it('should fail when videoId is only whitespace', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: '   ',
        userId: 'test-user-456',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ValidationError);
      expect((result as any).error.message).toBe('Video ID is required');
    });

    it('should fail when userId is empty', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: '',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ValidationError);
      expect((result as any).error.message).toBe('User ID is required');
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it('should fail when userId is only whitespace', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: '   ',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ValidationError);
      expect((result as any).error.message).toBe('User ID is required');
    });

    it('should fail when both videoId and userId are invalid', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: '',
        userId: '',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ValidationError);
      expect((result as any).error.message).toBe('Video ID is required'); // First validation error
    });
  });

  describe('JWT signing errors', () => {
    it('should handle JWT signing errors gracefully', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: 'test-user-456',
      };

      mockJwt.sign.mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ValidationError);
      expect((result as any).error.message).toBe('Failed to generate token');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate video token',
        expect.any(Error),
      );
    });

    it('should handle unexpected errors during token generation', async () => {
      // Arrange
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: 'test-user-456',
      };

      mockJwt.sign.mockImplementation(() => {
        throw new TypeError('Unexpected type error');
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ValidationError);
      expect((result as any).error.message).toBe('Failed to generate token');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate video token',
        expect.any(TypeError),
      );
    });
  });

  describe('Configuration handling', () => {
    it('should use correct configuration values', async () => {
      // Arrange
      const customDependencies: GenerateVideoTokenDependencies = {
        jwt: mockJwt,
        config: {
          jwtSecret: 'custom-secret',
          jwtIssuer: 'custom-issuer',
          jwtAudience: 'custom-audience',
          jwtExpiry: '30m',
        },
        logger: mockLogger,
      };

      const customUseCase = new GenerateVideoTokenUseCase(customDependencies);
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: 'test-user-456',
      };

      mockJwt.sign.mockReturnValue('custom-token');

      // Act
      await customUseCase.execute(request);

      // Assert
      expect(mockJwt.sign).toHaveBeenCalledWith(
        expect.any(Object),
        'custom-secret',
        {
          expiresIn: '30m',
          issuer: 'custom-issuer',
          audience: 'custom-audience',
        },
      );
    });
  });

  describe('Without logger', () => {
    it('should work without logger dependency', async () => {
      // Arrange
      const dependenciesWithoutLogger: GenerateVideoTokenDependencies = {
        jwt: mockJwt,
        config: mockConfig,
        // No logger
      };

      const useCaseWithoutLogger = new GenerateVideoTokenUseCase(dependenciesWithoutLogger);
      const request: GenerateVideoTokenRequest = {
        videoId: 'test-video-123',
        userId: 'test-user-456',
      };

      mockJwt.sign.mockReturnValue('token-without-logger');

      // Act
      const result = await useCaseWithoutLogger.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect((result as any).data).toEqual({
        token: 'token-without-logger',
      });
      // Should not throw error when trying to log
    });
  });
});
