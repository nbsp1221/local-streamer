import type { Route } from "./+types/logout";
import { logout } from "~/utils/auth.server";

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 }
    );
  }
  
  try {
    // redirectTo 파라미터 확인
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo') || '/login';
    
    console.log('🚪 User logged out');
    
    // 로그아웃 처리 (세션 삭제 및 리다이렉션)
    return await logout(request, redirectTo);
    
  } catch (error) {
    console.error('Logout error:', error);
    
    // 에러가 발생해도 로그아웃 처리
    return await logout(request, '/login');
  }
}

// GET 요청도 지원 (URL로 직접 로그아웃 가능)
export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  try {
    console.log('🚪 User logged out (GET)');
    return await logout(request, '/login');
  } catch (error) {
    console.error('Logout error:', error);
    return await logout(request, '/login');
  }
}