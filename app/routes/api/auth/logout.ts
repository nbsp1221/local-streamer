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
    // Check redirectTo parameter
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo') || '/login';
    
    console.log('🚪 User logged out');
    
    // Process logout (delete session and redirect)
    return await logout(request, redirectTo);
    
  } catch (error) {
    console.error('Logout error:', error);
    
    // Process logout even on error
    return await logout(request, '/login');
  }
}

// Also supports GET requests (direct logout via URL)
export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  try {
    console.log('🚪 User logged out (GET)');
    return await logout(request, '/login');
  } catch (error) {
    console.error('Logout error:', error);
    return await logout(request, '/login');
  }
}