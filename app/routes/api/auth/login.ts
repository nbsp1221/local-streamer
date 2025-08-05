import type { Route } from "./+types/login";
import { authenticateUser } from "~/services/user-store.server";
import { isValidEmail, addLoginDelay, toPublicUser, getClientIP } from "~/utils/auth.server";
import { createSession, serializeCookie, getCookieOptions, COOKIE_NAME } from "~/services/session-store.server";
import type { LoginFormData, AuthResponse } from "~/types/auth";

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 }
    );
  }
  
  try {
    // 요청 데이터 파싱
    const formData: LoginFormData = await request.json();
    const { email, password } = formData;
    
    // 입력값 검증
    if (!email || !password) {
      await addLoginDelay();
      return Response.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // 이메일 형식 검증
    if (!isValidEmail(email)) {
      await addLoginDelay();
      return Response.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }
    
    // 사용자 인증
    const user = await authenticateUser(email, password);
    
    if (!user) {
      // 실패 시 지연 추가 (무차별 대입 공격 방어)
      await addLoginDelay();
      return Response.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      );
    }
    
    console.log(`✅ User logged in: ${user.email} (${user.id})`);
    
    // User-Agent와 IP 주소 추출
    const userAgent = request.headers.get('User-Agent') || undefined;
    const ipAddress = getClientIP(request);
    
    // 새 세션 생성
    const session = await createSession(user.id, userAgent, ipAddress);
    
    // 쿠키 설정
    const cookieOptions = getCookieOptions();
    const cookieString = serializeCookie(COOKIE_NAME, session.id, cookieOptions);
    
    // JSON 응답 반환 (쿠키 포함)
    return Response.json(
      { 
        success: true, 
        user: toPublicUser(user)
      },
      {
        headers: {
          'Set-Cookie': cookieString,
        },
      }
    );
    
  } catch (error) {
    console.error('Login error:', error);
    
    // 에러 시에도 지연 추가
    await addLoginDelay();
    
    return Response.json(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}