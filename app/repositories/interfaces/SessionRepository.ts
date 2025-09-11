import type { CookieOptions, Session } from '~/types/auth';
import type { BaseRepository } from './BaseRepository';

/**
 * Input for creating a new session
 */
export interface CreateSessionInput {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Input for updating an existing session
 */
export interface UpdateSessionInput {
  userId?: string;
  expiresAt?: Date;
  userAgent?: string;
  ipAddress?: string;
  isActive?: boolean;
}

/**
 * Session repository interface extending base repository with session-specific methods
 */
export interface SessionRepository extends BaseRepository<Session, CreateSessionInput, UpdateSessionInput> {
  /**
   * Find sessions by user ID
   */
  findByUserId(userId: string): Promise<Session[]>;

  /**
   * Find active sessions for a user
   */
  findActiveByUserId(userId: string): Promise<Session[]>;

  /**
   * Clean up expired sessions
   */
  cleanupExpired(): Promise<number>;

  /**
   * Refresh session expiry
   */
  refreshSession(sessionId: string): Promise<Session | null>;

  /**
   * Deactivate session
   */
  deactivateSession(sessionId: string): Promise<boolean>;

  /**
   * Deactivate all sessions for a user
   */
  deactivateAllUserSessions(userId: string): Promise<number>;

  /**
   * Completely delete all sessions for a user (vs deactivate)
   */
  deleteAllUserSessions(userId: string): Promise<number>;

  /**
   * Validate session with optional security checks
   */
  validateSession(sessionId: string, userAgent?: string, ipAddress?: string): Promise<Session | null>;

  /**
   * Check if session is valid and not expired
   */
  isValidSession(sessionId: string): Promise<boolean>;

  /**
   * Get cookie options for sessions
   */
  getCookieOptions(maxAge?: number): CookieOptions;
}
