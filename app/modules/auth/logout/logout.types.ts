import type { SessionRepository } from '~/repositories/interfaces/SessionRepository';

/**
 * Request input for logout operation
 */
export interface LogoutRequest {
  /**
   * Session ID to logout (extracted from cookie)
   */
  sessionId?: string;

  /**
   * Redirect URL after logout
   */
  redirectTo?: string;
}

/**
 * Response from logout operation
 */
export interface LogoutResponse {
  /**
   * Success status
   */
  success: boolean;

  /**
   * Cookie string to clear session
   */
  cookieString: string;

  /**
   * Redirect URL
   */
  redirectTo: string;
}

/**
 * Dependencies required for logout use case
 */
export interface LogoutDependencies {
  /**
   * Session repository for session management
   */
  sessionRepository: SessionRepository;

  /**
   * Cookie manager for clearing session cookies
   */
  cookieManager: {
    getDeleteString(name: string): string;
    cookieName: string;
  };

  /**
   * Logger for audit trail
   */
  logger?: {
    info(message: string, data?: any): void;
    error(message: string, error?: any): void;
  };
}
