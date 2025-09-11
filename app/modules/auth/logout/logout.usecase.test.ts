import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LogoutDependencies } from './logout.types';
import { LogoutUseCase } from './logout.usecase';

describe('LogoutUseCase', () => {
  const mockSessionRepository = {
    delete: vi.fn(),
  } as any;

  const mockCookieManager = {
    getDeleteString: vi.fn(),
    cookieName: 'session_id',
  };

  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  const dependencies: LogoutDependencies = {
    sessionRepository: mockSessionRepository,
    cookieManager: mockCookieManager,
    logger: mockLogger,
  };

  let useCase: LogoutUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    useCase = new LogoutUseCase(dependencies);
  });

  describe('execute', () => {
    it('should successfully logout with session ID', async () => {
      // Arrange
      const sessionId = 'test-session-id';
      mockSessionRepository.delete.mockResolvedValue(true);
      mockCookieManager.getDeleteString.mockReturnValue('session_id=; Max-Age=0; Path=/; HttpOnly');

      // Act
      const result = await useCase.execute({ sessionId, redirectTo: '/home' });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          success: true,
          cookieString: 'session_id=; Max-Age=0; Path=/; HttpOnly',
          redirectTo: '/home',
        });
      }
      expect(mockSessionRepository.delete).toHaveBeenCalledWith(sessionId);
      expect(mockCookieManager.getDeleteString).toHaveBeenCalledWith('session_id');
      expect(mockLogger.info).toHaveBeenCalledWith('User logged out successfully', { sessionId });
    });

    it('should successfully logout without session ID', async () => {
      // Arrange
      mockCookieManager.getDeleteString.mockReturnValue('session_id=; Max-Age=0; Path=/; HttpOnly');

      // Act
      const result = await useCase.execute({ redirectTo: '/login' });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          success: true,
          cookieString: 'session_id=; Max-Age=0; Path=/; HttpOnly',
          redirectTo: '/login',
        });
      }
      expect(mockSessionRepository.delete).not.toHaveBeenCalled();
      expect(mockCookieManager.getDeleteString).toHaveBeenCalledWith('session_id');
    });

    it('should use default redirect URL when not provided', async () => {
      // Arrange
      mockCookieManager.getDeleteString.mockReturnValue('session_id=; Max-Age=0; Path=/; HttpOnly');

      // Act
      const result = await useCase.execute({});

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.redirectTo).toBe('/login');
      }
    });

    it('should continue logout even if session deletion fails', async () => {
      // Arrange
      const sessionId = 'test-session-id';
      mockSessionRepository.delete.mockResolvedValue(false); // Session not found
      mockCookieManager.getDeleteString.mockReturnValue('session_id=; Max-Age=0; Path=/; HttpOnly');

      // Act
      const result = await useCase.execute({ sessionId });

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({
          success: true,
          cookieString: 'session_id=; Max-Age=0; Path=/; HttpOnly',
          redirectTo: '/login',
        });
      }
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      const sessionId = 'test-session-id';
      mockSessionRepository.delete.mockRejectedValue(new Error('Database error'));
      mockCookieManager.getDeleteString.mockReturnValue('session_id=; Max-Age=0; Path=/; HttpOnly');

      // Act
      const result = await useCase.execute({ sessionId });

      // Assert
      expect(result.success).toBe(true); // Should still succeed for logout
      if (result.success) {
        expect(result.data).toEqual({
          success: true,
          cookieString: 'session_id=; Max-Age=0; Path=/; HttpOnly',
          redirectTo: '/login',
        });
      }
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to delete session during logout', expect.any(Error));
    });
  });
});
