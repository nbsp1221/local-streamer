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

// Request에서 사용자 정보 추출 (인증 필수)
export async function requireAuth(request: Request): Promise<User> {
  // 먼저 관리자 계정이 있는지 확인
  const adminExists = await hasAdminUser();
  if (!adminExists) {
    // 관리자가 없으면 설정 페이지로 리다이렉트
    throw redirect('/setup');
  }

  const user = await getOptionalUser(request);
  
  if (!user) {
    // 현재 URL을 저장해서 로그인 후 돌아갈 수 있도록 함
    const url = new URL(request.url);
    const redirectTo = url.pathname + url.search;
    const searchParams = new URLSearchParams([['redirectTo', redirectTo]]);
    
    throw redirect(`/login?${searchParams}`);
  }
  
  return user;
}

// Request에서 사용자 정보 추출 (선택적)
export async function getOptionalUser(request: Request): Promise<User | null> {
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;
  
  try {
    // 세션 조회 및 자동 갱신
    const session = await refreshSession(sessionId);
    if (!session) return null;
    
    // 사용자 정보 조회
    const user = await findUserById(session.userId);
    return user;
  } catch (error) {
    console.error('Failed to get user from session:', error);
    return null;
  }
}

// 공개 사용자 정보 반환 (패스워드 해시 제외)
export function toPublicUser(user: User): PublicUser {
  const { passwordHash, ...publicUser } = user;
  return publicUser;
}

// 사용자 세션 생성 및 쿠키 설정
export async function createUserSession(
  user: User,
  request: Request,
  redirectTo: string = '/'
): Promise<Response> {
  // User-Agent와 IP 주소 추출
  const userAgent = request.headers.get('User-Agent') || undefined;
  const ipAddress = getClientIP(request);
  
  // 새 세션 생성
  const session = await createSession(user.id, userAgent, ipAddress);
  
  // 쿠키 설정
  const cookieOptions = getCookieOptions();
  const cookieString = serializeCookie(COOKIE_NAME, session.id, cookieOptions);
  
  return redirect(redirectTo, {
    headers: {
      'Set-Cookie': cookieString,
    },
  });
}

// 로그아웃 처리
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

// 초기 설정 필요 여부 확인
export async function checkSetupRequired(): Promise<boolean> {
  return !(await hasAdminUser());
}

// 관리자 권한 확인
export async function requireAdmin(request: Request): Promise<User> {
  const user = await requireAuth(request);
  
  if (user.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
  
  return user;
}

// 현재 사용자 또는 관리자 권한 확인
export async function requireOwnerOrAdmin(request: Request, targetUserId: string): Promise<User> {
  const user = await requireAuth(request);
  
  if (user.id !== targetUserId && user.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
  
  return user;
}

// 클라이언트 IP 주소 추출
export function getClientIP(request: Request): string | undefined {
  // Reverse proxy headers 체크
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

// 세션 유효성 검사 (미들웨어용)
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
      // 사용자가 삭제된 경우 세션도 삭제
      await deleteSession(sessionId);
      return { user: null, sessionValid: false };
    }
    
    return { user, sessionValid: true };
  } catch (error) {
    console.error('Session validation error:', error);
    return { user: null, sessionValid: false };
  }
}

// API 응답 생성 헬퍼
export function createAuthResponse(success: boolean, data?: any, error?: string) {
  return Response.json({
    success,
    ...data,
    ...(error && { error }),
  });
}

// 인증 실패 응답 생성
export function createUnauthorizedResponse(message: string = 'Authentication required') {
  return Response.json(
    { success: false, error: message },
    { status: 401 }
  );
}

// 권한 없음 응답 생성
export function createForbiddenResponse(message: string = 'Insufficient permissions') {
  return Response.json(
    { success: false, error: message },
    { status: 403 }
  );
}

// 이메일 유효성 검사
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 패스워드 강도 검사 (단순화)
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

// 로그인 실패 시 지연 (무차별 대입 공격 방어)
export async function addLoginDelay(): Promise<void> {
  // 500ms ~ 1500ms 랜덤 지연
  const delay = Math.floor(Math.random() * 1000) + 500;
  await new Promise(resolve => setTimeout(resolve, delay));
}