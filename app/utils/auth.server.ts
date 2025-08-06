import { redirect } from 'react-router';
import { findUserById, hasAdminUser } from '~/services/user-store.server';
import {
  createSession,
  getSession,
  deleteSession,
  refreshSession,
  getSessionIdFromRequest,
  serializeCookie,
  getDeleteCookieString,
  getCookieOptions,
  COOKIE_NAME,
} from '~/services/session-store.server';
import type { User, PublicUser } from '~/types/auth';

// Extract user info from request (authentication required)
export async function requireAuth(request: Request): Promise<User> {
  // Check if admin account exists first
  const adminExists = await hasAdminUser();
  if (!adminExists) {
    // Redirect to setup page if no admin exists
    throw redirect('/setup');
  }

  const user = await getOptionalUser(request);
  
  if (!user) {
    // Save current URL to return after login
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
    
    throw redirect(`/login?${searchParams}`);
  }
  
  return user;
}

// Extract user info from request (optional)
export async function getOptionalUser(request: Request): Promise<User | null> {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;
  
  try {
    // Get session and auto-refresh
    const session = await refreshSession(sessionId);
    if (!session) return null;
    
    // Get user info
    const user = await findUserById(session.userId);
    return user;
  } catch (error) {
    console.error('Failed to get user from session:', error);
    return null;
  }
}

// Return public user info (exclude password hash)
export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

// Create user session and set cookie
export async function createUserSession(
  user: User,
  request: Request,
  redirectTo: string = '/'
): Promise<Response> {
  // Extract User-Agent and IP address
  const userAgent = request.headers.get('User-Agent') || undefined;
  const ipAddress = getClientIP(request);
  
  // Create new session
  const session = await createSession(user.id, userAgent, ipAddress);
  
  // Set cookie
  const cookieOptions = getCookieOptions();
  const cookieString = serializeCookie(COOKIE_NAME, session.id, cookieOptions);
  
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': cookieString,
    },
  });
}

// Handle logout
export async function logout(request: Request, redirectTo: string = '/login'): Promise<Response> {
  const sessionId = getSessionIdFromRequest(request);
  
  if (sessionId) {
    await deleteSession(sessionId);
  }
  
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': getDeleteCookieString(COOKIE_NAME),
    },
  });
}

// Check if initial setup is required
export async function checkSetupRequired(): Promise<boolean> {
  return !(await hasAdminUser());
}

// Verify admin privileges
export async function requireAdmin(request: Request): Promise<User> {
  const user = await requireAuth(request);
  
  if (user.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
  
  return user;
}

// Verify current user or admin privileges
export async function requireOwnerOrAdmin(request: Request, targetUserId: string): Promise<User> {
  const user = await requireAuth(request);
  
  if (user.id !== targetUserId && user.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
  
  return user;
}

// Extract client IP address
export function getClientIP(request: Request): string | undefined {
  // Check reverse proxy headers
  const forwarded = request.headers.get('X-Forwarded-For');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = request.headers.get('X-Real-IP');
  if (realIP) {
    return realIP;
  }
  
  // Cloudflare
  const cfIP = request.headers.get('CF-Connecting-IP');
  if (cfIP) {
    return cfIP;
  }
  
  return undefined;
}

// Validate session (for middleware)
export async function validateSessionMiddleware(request: Request): Promise<{
  user: User | null;
  sessionValid: boolean;
}> {
  const sessionId = getSessionIdFromRequest(request);
  
  if (!sessionId) {
    return { user: null, sessionValid: false };
  }
  
  try {
    const session = await getSession(sessionId);
    if (!session) {
      return { user: null, sessionValid: false };
    }
    
    const user = await findUserById(session.userId);
    if (!user) {
      // Delete session if user was deleted
      await deleteSession(sessionId);
      return { user: null, sessionValid: false };
    }
    
    return { user, sessionValid: true };
  } catch (error) {
    console.error('Session validation error:', error);
    return { user: null, sessionValid: false };
  }
}

// API response helper
export function createAuthResponse(success: boolean, data?: any, error?: string) {
  return Response.json({
    success,
    ...data,
    ...(error && { error }),
  });
}

// Create unauthorized response
export function createUnauthorizedResponse(message: string = 'Authentication required') {
  return Response.json(
    { success: false, error: message },
    { status: 401 }
  );
}

// Create forbidden response
export function createForbiddenResponse(message: string = 'Insufficient permissions') {
  return Response.json(
    { success: false, error: message },
    { status: 403 }
  );
}

// Validate email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Check password strength (simplified)
export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 4) {
    errors.push('Password must be at least 4 characters long');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Add delay on login failure (brute force protection)
export async function addLoginDelay(): Promise<void> {
  // 500ms ~ 1500ms random delay
  const delay = Math.floor(Math.random() * 1000) + 500;
  await new Promise(resolve => setTimeout(resolve, delay));
}