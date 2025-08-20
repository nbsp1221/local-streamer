import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, InternalError, ValidationError } from '~/lib/errors';
import type { SetupUserDependencies, SetupUserRequest } from './setup-user.types';
import { SetupUserUseCase } from './setup-user.usecase';

describe('SetupUserUseCase', () => {
  let useCase: SetupUserUseCase;
  let mockDependencies: SetupUserDependencies;
  let mockUserRepository: any;
  let mockSessionRepository: any;
  let mockSessionManager: any;
  let mockSecurityService: any;
  let mockLogger: any;

  beforeEach(() => {
    // Create mock user repository
    mockUserRepository = {
      hasAdminUser: vi.fn(),
      create: vi.fn(),
    };

    // Create mock session repository
    mockSessionRepository = {
      create: vi.fn(),
      findByUserId: vi.fn(),
    };

    // Create mock session manager
    mockSessionManager = {
      createSession: vi.fn(),
      getCookieOptions: vi.fn(),
      serializeCookie: vi.fn(),
      cookieName: 'session',
    };

    // Create mock security service
    mockSecurityService = {
      isValidEmail: vi.fn(),
      isValidPassword: vi.fn(),
      addLoginDelay: vi.fn(),
      getClientIP: vi.fn(),
      toPublicUser: vi.fn(),
    };

    // Create mock logger
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };

    // Setup dependencies
    mockDependencies = {
      userRepository: mockUserRepository,
      sessionRepository: mockSessionRepository,
      sessionManager: mockSessionManager,
      securityService: mockSecurityService,
      logger: mockLogger,
    };

    useCase = new SetupUserUseCase(mockDependencies);
  });

  describe('execute - Success scenarios', () => {
    it('should create admin user successfully', async () => {
      // Arrange
      const request: SetupUserRequest = {
        email: 'admin@example.com',
        password: 'SecurePassword123!',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      const mockUser = {
        id: 'user-123',
        email: 'admin@example.com',
        role: 'admin',
      };

      const mockSession = { id: 'session-123' };

      mockUserRepository.hasAdminUser.mockResolvedValue(false);
      mockSecurityService.isValidEmail.mockReturnValue(true);
      mockSecurityService.isValidPassword.mockReturnValue({ valid: true, errors: [] });
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockSessionManager.createSession.mockResolvedValue(mockSession);
      mockSessionManager.getCookieOptions.mockReturnValue({ httpOnly: true });
      mockSessionManager.serializeCookie.mockReturnValue('session=session-123; HttpOnly');
      mockSecurityService.toPublicUser.mockReturnValue({
        id: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.userId).toBe('user-123');
        expect(result.data.sessionId).toBe('session-123');
        expect(result.data.cookieString).toBe('session=session-123; HttpOnly');
        expect(result.data.message).toContain('successfully');
        expect(result.data.user.email).toBe('admin@example.com');
      }

      expect(mockUserRepository.hasAdminUser).toHaveBeenCalledOnce();
      expect(mockUserRepository.create).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'SecurePassword123!',
        role: 'admin',
      });
      expect(mockSessionManager.createSession).toHaveBeenCalledWith('user-123', 'Mozilla/5.0', '192.168.1.1');
      expect(mockSessionManager.getCookieOptions).toHaveBeenCalledOnce();
      expect(mockSessionManager.serializeCookie).toHaveBeenCalledWith('session', 'session-123', { httpOnly: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Admin user created: admin@example.com'),
      );
    });
  });

  describe('execute - Validation errors', () => {
    it('should fail when admin already exists', async () => {
      // Arrange
      const request: SetupUserRequest = {
        email: 'admin@example.com',
        password: 'SecurePassword123!',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      mockUserRepository.hasAdminUser.mockResolvedValue(true);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ConflictError);
        expect(result.error.message).toContain('Admin user already exists');
      }

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should fail when email is missing', async () => {
      // Arrange
      const request: SetupUserRequest = {
        email: '',
        password: 'SecurePassword123!',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      mockUserRepository.hasAdminUser.mockResolvedValue(false);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Email and password are required');
      }
    });

    it('should fail when password is missing', async () => {
      // Arrange
      const request: SetupUserRequest = {
        email: 'admin@example.com',
        password: '',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      mockUserRepository.hasAdminUser.mockResolvedValue(false);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Email and password are required');
      }
    });

    it('should fail when email format is invalid', async () => {
      // Arrange
      const request: SetupUserRequest = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      mockUserRepository.hasAdminUser.mockResolvedValue(false);
      mockSecurityService.isValidEmail.mockReturnValue(false);

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Invalid email address');
      }
    });

    it('should fail when password is weak', async () => {
      // Arrange
      const request: SetupUserRequest = {
        email: 'admin@example.com',
        password: 'weak',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      mockUserRepository.hasAdminUser.mockResolvedValue(false);
      mockSecurityService.isValidEmail.mockReturnValue(true);
      mockSecurityService.isValidPassword.mockReturnValue({
        valid: false,
        errors: ['Password too short', 'Must contain uppercase letter'],
      });

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Password too short, Must contain uppercase letter');
      }
    });
  });

  describe('execute - Error handling', () => {
    it('should handle user creation failure', async () => {
      // Arrange
      const request: SetupUserRequest = {
        email: 'admin@example.com',
        password: 'SecurePassword123!',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      mockUserRepository.hasAdminUser.mockResolvedValue(false);
      mockSecurityService.isValidEmail.mockReturnValue(true);
      mockSecurityService.isValidPassword.mockReturnValue({ valid: true, errors: [] });
      mockUserRepository.create.mockRejectedValue(new Error('Database error'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Database error');
      }

      expect(mockSecurityService.addLoginDelay).toHaveBeenCalledOnce();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle session creation failure', async () => {
      // Arrange
      const request: SetupUserRequest = {
        email: 'admin@example.com',
        password: 'SecurePassword123!',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      };

      const mockUser = {
        id: 'user-123',
        email: 'admin@example.com',
        role: 'admin',
      };

      mockUserRepository.hasAdminUser.mockResolvedValue(false);
      mockSecurityService.isValidEmail.mockReturnValue(true);
      mockSecurityService.isValidPassword.mockReturnValue({ valid: true, errors: [] });
      mockUserRepository.create.mockResolvedValue(mockUser);
      mockSessionManager.createSession.mockRejectedValue(new Error('Session service unavailable'));

      // Act
      const result = await useCase.execute(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(InternalError);
        expect(result.error.message).toContain('Failed to create session');
      }

      // Note: addLoginDelay is not called for session creation failures
      // as they are technical errors, not authentication failures
    });
  });
});
