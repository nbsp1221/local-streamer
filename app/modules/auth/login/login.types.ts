import type { PublicUser, User } from '~/types/auth';

export interface LoginRequest {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

export interface LoginResponse {
  success: true;
  user: PublicUser;
  sessionId: string;
  cookieString: string;
}

export interface LoginDependencies {
  userRepository: {
    authenticate: (email: string, password: string) => Promise<User | null>;
  };
  sessionRepository: {
    createSession: (userId: string, userAgent?: string, ipAddress?: string) => Promise<{ id: string }>;
  };
  logger?: {
    info: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
    warn: (message: string, meta?: any) => void;
  };
  addLoginDelay: () => Promise<void>;
  isValidEmail: (email: string) => boolean;
}
