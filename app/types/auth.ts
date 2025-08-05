export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface CreateUserData {
  email: string;
  password: string;
  role?: 'admin' | 'user';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginData) => Promise<void>;
  logout: () => Promise<void>;
}

export interface CookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  maxAge: number;
  path: string;
}

// API Response types
export interface AuthResponse {
  success: boolean;
  user?: Omit<User, 'passwordHash'>;
  error?: string;
  message?: string;
}

export interface SetupResponse {
  success: boolean;
  message?: string;
  error?: string;
  needsSetup?: boolean;
}

// Form validation types
export interface SetupFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}

// Utility types
export type PublicUser = Omit<User, 'passwordHash'>;
export type SessionData = Omit<Session, 'userId'> & { user: PublicUser };