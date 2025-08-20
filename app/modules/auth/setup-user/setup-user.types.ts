import type { SessionRepository } from '~/repositories/interfaces/SessionRepository';

export interface SetupUserRequest {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface SetupUserResponse {
  userId: string;
  sessionId: string;
  cookieString: string;
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export interface SetupUserDependencies {
  userRepository: {
    hasAdminUser: () => Promise<boolean>;
    create: (userData: { email: string; password: string; role?: 'admin' | 'user' }) => Promise<any>;
  };
  sessionRepository: SessionRepository;
  sessionManager: {
    createSession: (userId: string, userAgent?: string, ipAddress?: string) => Promise<{ id: string }>;
    getCookieOptions: () => any;
    serializeCookie: (name: string, value: string, options: any) => string;
    cookieName: string;
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
