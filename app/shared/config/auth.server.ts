import path from 'node:path';

const DEFAULT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_SESSION_COOKIE_NAME = 'site_session';

export interface AuthConfig {
  sessionCookieName: string;
  sessionCookiePath: string;
  sessionCookieSecure: boolean;
  sessionTtlMs: number;
  sharedPassword: string;
  sqlitePath: string;
}

export function getAuthConfig(): AuthConfig {
  const sharedPassword = process.env.AUTH_SHARED_PASSWORD;

  if (!sharedPassword) {
    throw new Error('AUTH_SHARED_PASSWORD environment variable is required');
  }

  return {
    sessionCookieName: process.env.AUTH_SESSION_COOKIE_NAME || DEFAULT_SESSION_COOKIE_NAME,
    sessionCookiePath: '/',
    sessionCookieSecure: process.env.NODE_ENV === 'production',
    sessionTtlMs: Number.parseInt(process.env.AUTH_SESSION_TTL_MS || '', 10) || DEFAULT_SESSION_TTL_MS,
    sharedPassword,
    sqlitePath: process.env.AUTH_SQLITE_PATH || path.join(process.cwd(), 'storage', 'data', 'auth.sqlite'),
  };
}
