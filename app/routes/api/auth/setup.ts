import type { Route } from "./+types/setup";
import { createUser, hasAdminUser } from "~/services/user-store.server";
import { isValidEmail, isValidPassword, addLoginDelay, toPublicUser, getClientIP } from "~/utils/auth.server";
import { createSession, serializeCookie, getCookieOptions, COOKIE_NAME } from "~/services/session-store.server";
import type { SetupFormData, SetupResponse } from "~/types/auth";

export async function loader(): Promise<Response> {
  // 이미 관리자가 있는지 확인
  const adminExists = await hasAdminUser();
  
  const response: SetupResponse = {
    success: true,
    needsSetup: !adminExists
  };
  
  return Response.json(response);
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 }
    );
  }
  
  try {
    // Check if admin already exists
    const adminExists = await hasAdminUser();
    if (adminExists) {
      return Response.json(
        { success: false, error: 'Admin user already exists' },
        { status: 400 }
      );
    }
    
    // Parse request data
    const formData = await request.json();
    const { email, password } = formData;
    
    // Validate input values
    if (!email || !password) {
      return Response.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 }
      );
    }
    
    // Email validation check
    if (!isValidEmail(email)) {
      return Response.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }
    
    // 패스워드 강도 검사
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      return Response.json(
        { success: false, error: passwordValidation.errors.join(', ') },
        { status: 400 }
      );
    }
    
    // 관리자 계정 생성
    const newUser = await createUser({
      email,
      password,
      role: 'admin'
    });
    
    console.log(`✅ Admin user created: ${newUser.email} (${newUser.id})`);
    
    // User-Agent와 IP 주소 추출
    const userAgent = request.headers.get('User-Agent') || undefined;
    const ipAddress = getClientIP(request);
    
    // 새 세션 생성 (자동 로그인)
    const session = await createSession(newUser.id, userAgent, ipAddress);
    
    // 쿠키 설정
    const cookieOptions = getCookieOptions();
    const cookieString = serializeCookie(COOKIE_NAME, session.id, cookieOptions);
    
    // JSON 응답 반환 (쿠키 포함)
    return Response.json(
      { 
        success: true, 
        user: toPublicUser(newUser)
      },
      {
        headers: {
          'Set-Cookie': cookieString,
        },
      }
    );
    
  } catch (error) {
    console.error('Setup error:', error);
    
    // 지연 추가 (보안)
    await addLoginDelay();
    
    if (error instanceof Error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
    
    return Response.json(
      { success: false, error: 'Failed to create admin user' },
      { status: 500 }
    );
  }
}