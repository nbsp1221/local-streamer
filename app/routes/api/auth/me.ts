import type { Route } from "./+types/me";
import { getOptionalUser, toPublicUser, createUnauthorizedResponse } from "~/utils/auth.server";
import type { AuthResponse } from "~/types/auth";

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  try {
    const user = await getOptionalUser(request);
    
    if (!user) {
      return createUnauthorizedResponse('Not authenticated');
    }
    
    const response: AuthResponse = {
      success: true,
      user: toPublicUser(user)
    };
    
    return Response.json(response);
    
  } catch (error) {
    console.error('Get current user error:', error);
    
    return Response.json(
      { success: false, error: 'Failed to get user information' },
      { status: 500 }
    );
  }
}