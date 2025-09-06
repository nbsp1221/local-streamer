import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedError, ValidationError } from '~/lib/errors';
import type { ValidateVideoTokenDependencies, ValidateVideoTokenRequest } from './validate-token.types';
import { ValidateVideoTokenUseCase } from './validate-token.usecase';

describe('ValidateVideoTokenUseCase', () => {
  let mockJwt: any;
  let mockConfig: any;
  let mockLogger: any;
  let dependencies: ValidateVideoTokenDependencies;
  let useCase: ValidateVideoTokenUseCase;

  const validPayload = {
    videoId: 'test-video-123',
    userId: 'test-user-456',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Test Browser',
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    iat: Math.floor(Date.now() / 1000),
    iss: 'local-streamer',
    aud: 'video-streaming',
  };

  beforeEach(() => {
    mockJwt = {
      verify: vi.fn(),
      TokenExpiredError: class TokenExpiredError extends Error {
        constructor() {
          super('Token expired');
          this.name = 'TokenExpiredError';
        }
      },
      JsonWebTokenError: class JsonWebTokenError extends Error {
        constructor() {
          super('Invalid token');
          this.name = 'JsonWebTokenError';
        }
      },
    };

    mockConfig = {
      jwtSecret: 'test-secret',
      jwtIssuer: 'local-streamer',
      jwtAudience: 'video-streaming',
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

    useCase = new ValidateVideoTokenUseCase(dependencies);
  });

  describe('Success scenarios', () => {
    it('should validate token successfully without video ID check', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'valid-token',
      };

      mockJwt.verify.mockReturnValue(validPayload);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect((result as any).data).toEqual({
        valid: true,
        payload: validPayload,
      });
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-secret', {
        issuer: 'local-streamer',
        audience: 'video-streaming',
      });
      expect(mockLogger.info).toHaveBeenCalledWith('JWT token validated successfully', {
        videoId: 'test-video-123',
        userId: 'test-user-456',
      });
    });

    it('should validate token successfully with matching video ID', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'valid-token',
        expectedVideoId: 'test-video-123',
      };

      mockJwt.verify.mockReturnValue(validPayload);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect((result as any).data).toEqual({
        valid: true,
        payload: validPayload,
      });
    });

    it('should validate token successfully with matching IP and User-Agent', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'valid-token',
        expectedVideoId: 'test-video-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
      };

      mockJwt.verify.mockReturnValue(validPayload);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect((result as any).data).toEqual({
        valid: true,
        payload: validPayload,
      });
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Validation errors', () => {
    it('should fail when token is empty', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: '',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ValidationError);
      expect((result as any).error.message).toBe('Token is required');
      expect(mockJwt.verify).not.toHaveBeenCalled();
    });

    it('should fail when token is only whitespace', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: '   ',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(ValidationError);
      expect((result as any).error.message).toBe('Token is required');
    });
  });

  describe('JWT verification errors', () => {
    it('should fail when token is expired', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'expired-token',
      };

      mockJwt.verify.mockImplementation(() => {
        throw new mockJwt.TokenExpiredError();
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(UnauthorizedError);
      expect((result as any).error.message).toBe('Token expired');
      expect(mockLogger.warn).toHaveBeenCalledWith('JWT token validation failed', {
        error: 'Token expired',
      });
    });

    it('should fail when token has invalid signature', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'invalid-signature-token',
      };

      mockJwt.verify.mockImplementation(() => {
        throw new mockJwt.JsonWebTokenError();
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(UnauthorizedError);
      expect((result as any).error.message).toBe('Invalid token signature');
    });

    it('should fail with generic error for unknown JWT error', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'malformed-token',
      };

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Unknown JWT error');
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(UnauthorizedError);
      expect((result as any).error.message).toBe('Invalid token');
    });
  });

  describe('Video ID validation', () => {
    it('should fail when video ID does not match', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'valid-token',
        expectedVideoId: 'different-video-456',
      };

      mockJwt.verify.mockReturnValue(validPayload);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(UnauthorizedError);
      expect((result as any).error.message).toBe('Token not valid for this video');
      expect(mockLogger.warn).toHaveBeenCalledWith('JWT token video ID mismatch', {
        expected: 'different-video-456',
        actual: 'test-video-123',
      });
    });
  });

  describe('IP and User-Agent warnings', () => {
    it('should warn when IP addresses do not match', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'valid-token',
        expectedVideoId: 'test-video-123',
        ipAddress: '192.168.1.2', // Different IP
      };

      mockJwt.verify.mockReturnValue(validPayload);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true); // Should still succeed but warn
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Video token IP mismatch: expected 192.168.1.1, got 192.168.1.2',
      );
    });

    it('should warn when User-Agent does not match', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'valid-token',
        expectedVideoId: 'test-video-123',
        userAgent: 'Different Browser', // Different User-Agent
      };

      mockJwt.verify.mockReturnValue(validPayload);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true); // Should still succeed but warn
      expect(mockLogger.warn).toHaveBeenCalledWith('Video token User-Agent mismatch');
    });

    it('should not warn when token does not contain IP/User-Agent info', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'valid-token',
        expectedVideoId: 'test-video-123',
        ipAddress: '192.168.1.2',
        userAgent: 'Different Browser',
      };

      const payloadWithoutIPUA = {
        ...validPayload,
        ip: undefined,
        userAgent: undefined,
      };
      mockJwt.verify.mockReturnValue(payloadWithoutIPUA);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('Unexpected errors', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      const request: ValidateVideoTokenRequest = {
        token: 'valid-token',
      };

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Unexpected system error');
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      expect((result as any).error).toBeInstanceOf(UnauthorizedError);
      expect((result as any).error.message).toBe('Invalid token');
      expect(mockLogger.warn).toHaveBeenCalledWith('JWT token validation failed', {
        error: 'Invalid token',
      });
    });
  });
});
