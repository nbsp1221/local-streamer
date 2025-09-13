import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InternalError, UnauthorizedError, ValidationError } from '~/lib/errors';
import type { LoginDependencies, LoginRequest } from './login.types';
import { LoginUseCase } from './login.usecase';

describe('LoginUseCase', () => {
  let useCase: LoginUseCase;
  let mockDependencies: LoginDependencies;
  let mockUserRepository: any;
  let mockSessionRepository: any;
  let mockLogger: any;
  let mockAddLoginDelay: any;
  let mockIsValidEmail: any;

  beforeEach(() => {
    // Create mock user repository
    mockUserRepository = {
      authenticate: vi.fn(),
    };

    // Create mock session repository
    mockSessionRepository = {
      createSession: vi.fn(),
    };

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    // Create mock functions
    mockAddLoginDelay = vi.fn().mockResolvedValue(undefined);
    mockIsValidEmail = vi.fn();

    // Setup dependencies
    mockDependencies = {
      userRepository: mockUserRepository,
      sessionRepository: mockSessionRepository,
      logger: mockLogger,
      addLoginDelay: mockAddLoginDelay,
      isValidEmail: mockIsValidEmail,
    };

    useCase = new LoginUseCase(mockDependencies);
  });

  describe('Successful login', () => {
    it('should authenticate user successfully with all fields', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'validpassword',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
        isActive: true,
      };

      mockIsValidEmail.mockReturnValue(true);
      mockUserRepository.authenticate.mockResolvedValue(mockUser);
      mockSessionRepository.createSession.mockResolvedValue(mockSession);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.success).toBe(true);
        expect(result.data.user.id).toBe('user-123');
        expect(result.data.user.email).toBe('test@example.com');
        expect(result.data.sessionId).toBe('session-123');
        expect(result.data.cookieString).toContain('session-123');
        expect(result.data.user).not.toHaveProperty('passwordHash');
      }

      expect(mockIsValidEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockUserRepository.authenticate).toHaveBeenCalledWith('test@example.com', 'validpassword');
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith('user-123', 'Mozilla/5.0', '192.168.1.1');
      expect(mockLogger.info).toHaveBeenCalledWith('User logged in successfully', {
        userId: 'user-123',
        email: 'test@example.com',
        sessionId: 'session-123',
        ip: '192.168.1.1',
      });
      expect(mockAddLoginDelay).not.toHaveBeenCalled();
    });

    it('should authenticate user successfully with minimal fields', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'validpassword',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session-456',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isActive: true,
      };

      mockIsValidEmail.mockReturnValue(true);
      mockUserRepository.authenticate.mockResolvedValue(mockUser);
      mockSessionRepository.createSession.mockResolvedValue(mockSession);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.id).toBe('user-123');
        expect(result.data.sessionId).toBe('session-456');
      }

      expect(mockSessionRepository.createSession).toHaveBeenCalledWith('user-123', undefined, undefined);
    });
  });

  describe('Validation errors', () => {
    it('should fail when email is missing', async () => {
      // Arrange
      const request: LoginRequest = {
        email: '',
        password: 'validpassword',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Email is required');
      }

      expect(mockAddLoginDelay).toHaveBeenCalled();
      expect(mockUserRepository.authenticate).not.toHaveBeenCalled();
    });

    it('should fail when password is missing', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: '',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Password is required');
      }

      expect(mockAddLoginDelay).toHaveBeenCalled();
      expect(mockUserRepository.authenticate).not.toHaveBeenCalled();
    });

    it('should fail when email format is invalid', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'invalid-email',
        password: 'validpassword',
      };

      mockIsValidEmail.mockReturnValue(false);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Invalid email format');
      }

      expect(mockIsValidEmail).toHaveBeenCalledWith('invalid-email');
      expect(mockAddLoginDelay).toHaveBeenCalled();
      expect(mockUserRepository.authenticate).not.toHaveBeenCalled();
    });

    it('should fail when email is only whitespace', async () => {
      // Arrange
      const request: LoginRequest = {
        email: '   ',
        password: 'validpassword',
      };

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Email is required');
      }

      expect(mockAddLoginDelay).toHaveBeenCalled();
    });
  });

  describe('Authentication failures', () => {
    it('should fail when user credentials are invalid', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'wrongpassword',
        ipAddress: '192.168.1.1',
      };

      mockIsValidEmail.mockReturnValue(true);
      mockUserRepository.authenticate.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
        expect(result.error.message).toContain('Invalid email or password');
      }

      expect(mockUserRepository.authenticate).toHaveBeenCalledWith('test@example.com', 'wrongpassword');
      expect(mockAddLoginDelay).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Login attempt with invalid credentials', {
        email: 'test@example.com',
        ip: '192.168.1.1',
      });
      expect(mockSessionRepository.createSession).not.toHaveBeenCalled();
    });

    it('should fail when user does not exist', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'nonexistent@example.com',
        password: 'anypassword',
      };

      mockIsValidEmail.mockReturnValue(true);
      mockUserRepository.authenticate.mockResolvedValue(null);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
        expect(result.error.message).toContain('Invalid email or password');
      }

      expect(mockAddLoginDelay).toHaveBeenCalled();
    });
  });

  describe('Repository operation failures', () => {
    it('should fail when user authentication throws error', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'validpassword',
      };

      mockIsValidEmail.mockReturnValue(true);
      mockUserRepository.authenticate.mockRejectedValue(new Error('Database connection error'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Database connection error');
      }

      expect(mockUserRepository.authenticate).toHaveBeenCalledWith('test@example.com', 'validpassword');
      expect(mockAddLoginDelay).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Login failed with unexpected error', expect.any(Error));
      expect(mockSessionRepository.createSession).not.toHaveBeenCalled();
    });

    it('should fail when session creation fails', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'validpassword',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockIsValidEmail.mockReturnValue(true);
      mockUserRepository.authenticate.mockResolvedValue(mockUser);
      mockSessionRepository.createSession.mockRejectedValue(new Error('Session creation failed'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Session creation failed');
      }

      expect(mockUserRepository.authenticate).toHaveBeenCalledWith('test@example.com', 'validpassword');
      expect(mockSessionRepository.createSession).toHaveBeenCalledWith('user-123', undefined, undefined);
      expect(mockAddLoginDelay).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Login failed with unexpected error', expect.any(Error));
    });
  });

  describe('Error handling without logger', () => {
    it('should work correctly without logger dependency', async () => {
      // Arrange
      const depsWithoutLogger = {
        userRepository: mockUserRepository,
        sessionRepository: mockSessionRepository,
        addLoginDelay: mockAddLoginDelay,
        isValidEmail: mockIsValidEmail,
        // No logger
      };

      const useCaseWithoutLogger = new LoginUseCase(depsWithoutLogger);

      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'validpassword',
      };

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
        isActive: true,
      };

      mockIsValidEmail.mockReturnValue(true);
      mockUserRepository.authenticate.mockResolvedValue(mockUser);
      mockSessionRepository.createSession.mockResolvedValue(mockSession);

      // Act
      const result = await useCaseWithoutLogger.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.id).toBe('user-123');
        expect(result.data.sessionId).toBe('session-123');
      }
    });
  });

  describe('Edge cases and security', () => {
    it('should handle null email gracefully', async () => {
      // Arrange
      const request = {
        email: null,
        password: 'validpassword',
      } as any;

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Email is required');
      }

      expect(mockAddLoginDelay).toHaveBeenCalled();
    });

    it('should handle null password gracefully', async () => {
      // Arrange
      const request = {
        email: 'test@example.com',
        password: null,
      } as any;

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Password is required');
      }

      expect(mockAddLoginDelay).toHaveBeenCalled();
    });

    it('should always add delay on authentication failure for security', async () => {
      // Arrange
      const request: LoginRequest = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      mockIsValidEmail.mockReturnValue(true);
      mockUserRepository.authenticate.mockResolvedValue(null);

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockAddLoginDelay).toHaveBeenCalledTimes(1);
    });

    it('should always add delay on validation failure for security', async () => {
      // Arrange
      const request: LoginRequest = {
        email: '',
        password: 'validpassword',
      };

      // Act
      await useCase.execute(request);

      // Assert
      expect(mockAddLoginDelay).toHaveBeenCalledTimes(1);
    });
  });
});
