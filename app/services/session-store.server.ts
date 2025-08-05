import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type { Session, CookieOptions } from '~/types/auth';

const DATA_DIR = path.join(process.cwd(), 'data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// 세션 설정
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7일 (밀리초)
const SESSION_REFRESH_THRESHOLD = 4 * 24 * 60 * 60 * 1000; // 4일 (세션 갱신 기준)

export const COOKIE_NAME = 'session_id';

// 쿠키 옵션 생성
export function getCookieOptions(maxAge?: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAge || SESSION_DURATION / 1000, // 초 단위
    path: '/'
  };
}

// 디렉토리와 파일이 존재하는지 확인하고 없으면 생성
async function ensureDataFiles() {
  try {
    // 데이터 디렉토리 생성
    if (!existsSync(DATA_DIR)) {
      await fs.mkdir(DATA_DIR, { recursive: true });
    }

    // sessions.json 파일 생성
    if (!existsSync(SESSIONS_FILE)) {
      await fs.writeFile(SESSIONS_FILE, '[]', 'utf-8');
    }
  } catch (error) {
    console.error('Failed to ensure session data files:', error);
    throw new Error('Failed to initialize session data files');
  }
}

// 세션 목록 조회
export async function getSessions(): Promise<Session[]> {
  try {
    await ensureDataFiles();
    const content = await fs.readFile(SESSIONS_FILE, 'utf-8');
    const sessions = JSON.parse(content);
    
    // Date 객체 복원
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

// 세션 목록 저장
export async function saveSessions(sessions: Session[]): Promise<void> {
  try {
    await ensureDataFiles();
    
    // Date 객체를 ISO 문자열로 변환
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

// 만료된 세션 정리
export async function cleanupExpiredSessions(): Promise<void> {
  const sessions = await getSessions();
  const now = new Date();
  const validSessions = sessions.filter(session => session.expiresAt > now);
  
  if (validSessions.length !== sessions.length) {
    await saveSessions(validSessions);
    console.log(`Cleaned up ${sessions.length - validSessions.length} expired sessions`);
  }
}

// 새 세션 생성
export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<Session> {
  // 먼저 만료된 세션들을 정리
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

// 세션 조회
export async function getSession(sessionId: string): Promise<Session | null> {
  if (!sessionId) return null;
  
  const sessions = await getSessions();
  const session = sessions.find(s => s.id === sessionId);
  
  if (!session) return null;
  
  // 세션 만료 확인
  if (session.expiresAt <= new Date()) {
    await deleteSession(sessionId);
    return null;
  }
  
  return session;
}

// 사용자 ID로 세션들 조회
export async function getSessionsByUserId(userId: string): Promise<Session[]> {
  const sessions = await getSessions();
  const now = new Date();
  
  return sessions.filter(session => 
    session.userId === userId && session.expiresAt > now
  );
}

// 세션 갱신 (만료 시간 연장)
export async function refreshSession(sessionId: string): Promise<Session | null> {
  const sessions = await getSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) return null;
  
  const session = sessions[sessionIndex];
  const now = new Date();
  
  // 세션이 만료되었으면 null 반환
  if (session.expiresAt <= now) {
    await deleteSession(sessionId);
    return null;
  }
  
  // 세션 갱신이 필요한지 확인 (남은 시간이 4일 미만인 경우)
  const timeUntilExpiry = session.expiresAt.getTime() - now.getTime();
  if (timeUntilExpiry < SESSION_REFRESH_THRESHOLD) {
    session.expiresAt = new Date(now.getTime() + SESSION_DURATION);
    sessions[sessionIndex] = session;
    await saveSessions(sessions);
    console.log(`Session ${sessionId} refreshed`);
  }
  
  return session;
}

// 세션 삭제
export async function deleteSession(sessionId: string): Promise<void> {
  const sessions = await getSessions();
  const filteredSessions = sessions.filter(session => session.id !== sessionId);
  await saveSessions(filteredSessions);
}

// 사용자의 모든 세션 삭제
export async function deleteUserSessions(userId: string): Promise<void> {
  const sessions = await getSessions();
  const filteredSessions = sessions.filter(session => session.userId !== userId);
  await saveSessions(filteredSessions);
}

// 세션 유효성 검증 (추가 보안 체크)
export async function validateSession(
  sessionId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<Session | null> {
  const session = await getSession(sessionId);
  
  if (!session) return null;
  
  // 선택적: User-Agent 검증 (보안 강화)
  if (session.userAgent && userAgent && session.userAgent !== userAgent) {
    console.warn(`Session ${sessionId}: User-Agent mismatch`);
    // 엄격한 보안이 필요한 경우 세션 무효화
    // await deleteSession(sessionId);
    // return null;
  }
  
  // 선택적: IP 주소 검증 (보안 강화)
  if (session.ipAddress && ipAddress && session.ipAddress !== ipAddress) {
    console.warn(`Session ${sessionId}: IP address mismatch`);
    // 엄격한 보안이 필요한 경우 세션 무효화
    // await deleteSession(sessionId);
    // return null;
  }
  
  return session;
}

// 쿠키 문자열 생성
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

// 쿠키 삭제용 문자열 생성
export function getDeleteCookieString(name: string): string {
  return serializeCookie(name, '', {
    ...getCookieOptions(),
    maxAge: 0
  });
}

// Request에서 세션 ID 추출
export function getSessionIdFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').map(cookie => cookie.trim());
  const sessionCookie = cookies.find(cookie => cookie.startsWith(`${COOKIE_NAME}=`));
  
  if (!sessionCookie) return null;
  
  return sessionCookie.split('=')[1] || null;
}