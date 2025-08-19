import type { SessionRepository } from '~/repositories/interfaces/SessionRepository';
import type { UserRepository } from '~/repositories/interfaces/UserRepository';

export interface SetupUserRequest {
  email: string;
  password: string;
}

export interface SetupUserResponse {
  userId: string;
  sessionId: string;
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface CheckSetupStatusResponse {
  needsSetup: boolean;
}

export interface SetupUserDependencies {
  userRepository: UserRepository;
  sessionRepository: SessionRepository;
  sessionManager: {
    createSession: (userId: string, userAgent?: string, ipAddress?: string) => Promise<{ id: string }>;
    getCookieOptions: () => any;
    serializeCookie: (name: string, value: string, options: any) => string;
  };
  securityService: {
    isValidEmail: (email: string) => boolean;
    isValidPassword: (password: string) => { valid: boolean; errors: string[] };
    addLoginDelay: () => Promise<void>;
    getClientIP: (request: Request) => string | undefined;
    toPublicUser: (user: any) => any;
  };
  logger?: {
    info: (message: string, data?: any) => void;
    error: (message: string, error?: any) => void;
  };
}
