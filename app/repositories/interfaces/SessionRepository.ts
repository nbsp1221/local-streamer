import type { Session, CookieOptions } from "~/types/auth";
import type { BaseRepository } from "./BaseRepository";

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
   * Check if session is valid and not expired
   */
  isValidSession(sessionId: string): Promise<boolean>;

  /**
   * Get cookie options for sessions
   */
  getCookieOptions(maxAge?: number): CookieOptions;
}