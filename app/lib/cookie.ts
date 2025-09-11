import type { CookieOptions } from '~/types/auth';
import { config } from '~/configs';

/**
 * Cookie management utility for session handling
 * Extracted from legacy session-store.server.ts for single responsibility
 */
export class CookieManager {
  public readonly cookieName = config.security.session.cookieName;

  /**
   * Get secure cookie options based on environment
   */
  getCookieOptions(maxAge?: number): CookieOptions {
    return {
      httpOnly: true,
      secure: config.server.isProduction,
      sameSite: 'lax',
      maxAge: maxAge || config.security.session.duration / 1000, // in seconds
      path: '/',
    };
  }

  /**
   * Serialize cookie with name, value and options
   */
  serialize(name: string, value: string, options: CookieOptions): string {
    let cookie = `${name}=${value}`;

    if (options.maxAge) {
      cookie += `; Max-Age=${options.maxAge}`;
    }

    if (options.path) {
      cookie += `; Path=${options.path}`;
    }

    if (options.httpOnly) {
      cookie += '; HttpOnly';
    }

    if (options.secure) {
      cookie += '; Secure';
    }

    if (options.sameSite) {
      cookie += `; SameSite=${options.sameSite}`;
    }

    return cookie;
  }

  /**
   * Create delete cookie string (expires immediately)
   */
  getDeleteString(name: string): string {
    return this.serialize(name, '', {
      ...this.getCookieOptions(),
      maxAge: 0,
    });
  }

  /**
   * Extract session ID from request cookie header
   */
  extractSessionId(request: Request): string | null {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
    const sessionCookie = cookies.find(cookie => cookie.startsWith(`${this.cookieName}=`));

    if (!sessionCookie) return null;

    return sessionCookie.split('=')[1] || null;
  }
}

/**
 * Singleton instance for global use
 */
export const cookieManager = new CookieManager();

/**
 * Legacy exports for compatibility during migration
 */
export const COOKIE_NAME = cookieManager.cookieName;
export const getCookieOptions = (maxAge?: number) => cookieManager.getCookieOptions(maxAge);
export const serializeCookie = (name: string, value: string, options: CookieOptions) => cookieManager.serialize(name, value, options);
export const getDeleteCookieString = (name: string) => cookieManager.getDeleteString(name);
export const getSessionIdFromRequest = (request: Request) => cookieManager.extractSessionId(request);
