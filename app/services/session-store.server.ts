import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Session, CookieOptions } from '~/types/auth';
import { config } from '~/configs';

const DATA_DIR = config.paths.data;
const SESSIONS_FILE = config.paths.sessionsJson;

// Session configuration
const SESSION_DURATION = config.security.session.duration;
const SESSION_REFRESH_THRESHOLD = config.security.session.refreshThreshold;

export const COOKIE_NAME = config.security.session.cookieName;

// Create cookie options
export function getCookieOptions(maxAge?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: config.server.isProduction,
    sameSite: 'lax',
    maxAge: maxAge || SESSION_DURATION / 1000, // in seconds
    path: '/'
  };
}

// Ensure directory and files exist, create if they don't
async function ensureDataFiles() {
  try {
    // Create data directory
    if (!existsSync(DATA_DIR)) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }

    // Create sessions.json file
    if (!existsSync(SESSIONS_FILE)) {
      await fs.writeFile(SESSIONS_FILE, '[]', 'utf-8');
    }
  } catch (error) {
    console.error('Failed to ensure session data files:', error);
    throw new Error('Failed to initialize session data files');
  }
}

// Get all sessions
export async function getSessions(): Promise<Session[]> {
  try {
    await ensureDataFiles();
    const content = await fs.readFile(SESSIONS_FILE, 'utf-8');
    const sessions = JSON.parse(content);
    
    // Restore Date objects
    return sessions.map((session: any) => ({
      ...session,
      createdAt: new Date(session.createdAt),
      expiresAt: new Date(session.expiresAt)
    }));
  } catch (error) {
    console.error('Failed to load sessions:', error);
    return [];
  }
}

// Save sessions list
export async function saveSessions(sessions: Session[]): Promise<void> {
  try {
    await ensureDataFiles();
    
    // Convert Date objects to ISO strings
    const serializedSessions = sessions.map(session => ({
      ...session,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString()
    }));
    
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(serializedSessions, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save sessions:', error);
    throw new Error('Failed to save sessions');
  }
}

// Clean up expired sessions
export async function cleanupExpiredSessions(): Promise<void> {
  const sessions = await getSessions();
  const now = new Date();
  const validSessions = sessions.filter(session => session.expiresAt > now);
  
  if (validSessions.length !== sessions.length) {
    await saveSessions(validSessions);
    console.log(`Cleaned up ${sessions.length - validSessions.length} expired sessions`);
  }
}

// Create new session
export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<Session> {
  // Clean up expired sessions first
  await cleanupExpiredSessions();
  
  const sessions = await getSessions();
  const now = new Date();
  
  const newSession: Session = {
    id: uuidv4(),
    userId,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_DURATION),
    userAgent,
    ipAddress
  };
  
  sessions.push(newSession);
  await saveSessions(sessions);
  
  return newSession;
}

// Get session
export async function getSession(sessionId: string): Promise<Session | null> {
  if (!sessionId) return null;
  
  const sessions = await getSessions();
  const session = sessions.find(s => s.id === sessionId);
  
  if (!session) return null;
  
  // Check session expiration
  if (session.expiresAt <= new Date()) {
    await deleteSession(sessionId);
    return null;
  }
  
  return session;
}

// Get sessions by user ID
export async function getSessionsByUserId(userId: string): Promise<Session[]> {
  const sessions = await getSessions();
  const now = new Date();
  
  return sessions.filter(session => 
    session.userId === userId && session.expiresAt > now
  );
}

// Refresh session (extend expiration time)
export async function refreshSession(sessionId: string): Promise<Session | null> {
  const sessions = await getSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) return null;
  
  const session = sessions[sessionIndex];
  const now = new Date();
  
  // Return null if session expired
  if (session.expiresAt <= now) {
    await deleteSession(sessionId);
    return null;
  }
  
  // Check if session needs refresh (less than 4 days remaining)
  const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();
  if (timeUntilExpiry < SESSION_REFRESH_THRESHOLD) {
    session.expiresAt = new Date(now.getTime() + SESSION_DURATION);
    sessions[sessionIndex] = session;
    await saveSessions(sessions);
    console.log(`Session ${sessionId} refreshed`);
  }
  
  return session;
}

// Delete session
export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getSessions();
  const filteredSessions = sessions.filter(session => session.id !== sessionId);
  await saveSessions(filteredSessions);
}

// Delete all user sessions
export async function deleteUserSessions(userId: string): Promise<void> {
  const sessions = await getSessions();
  const filteredSessions = sessions.filter(session => session.userId !== userId);
  await saveSessions(filteredSessions);
}

// Validate session (additional security checks)
export async function validateSession(
  sessionId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<Session | null> {
  const session = await getSession(sessionId);
  
  if (!session) return null;
  
  // Optional: User-Agent validation (security enhancement)
  if (session.userAgent && userAgent && session.userAgent !== userAgent) {
    console.warn(`Session ${sessionId}: User-Agent mismatch`);
    // Invalidate session if strict security is required
    // await deleteSession(sessionId);
    // return null;
  }
  
  // Optional: IP address validation (security enhancement)
  if (session.ipAddress && ipAddress && session.ipAddress !== ipAddress) {
    console.warn(`Session ${sessionId}: IP address mismatch`);
    // Invalidate session if strict security is required
    // await deleteSession(sessionId);
    // return null;
  }
  
  return session;
}

// Create cookie string
export function serializeCookie(name: string, value: string, options: CookieOptions): string {
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

// Create delete cookie string
export function getDeleteCookieString(name: string): string {
  return serializeCookie(name, '', {
    ...getCookieOptions(),
    maxAge: 0
  });
}

// Extract session ID from request
export function getSessionIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
  const sessionCookie = cookies.find(cookie => cookie.startsWith(`${COOKIE_NAME}=`));
  
  if (!sessionCookie) return null;
  
  return sessionCookie.split('=')[1] || null;
}