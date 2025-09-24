import type { LoaderFunctionArgs } from 'react-router';
import type { AuthResponse } from '~/types/auth';
import { createUnauthorizedResponse, getOptionalUser, toPublicUser } from '~/utils/auth.server';
export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  try {
    const user = await getOptionalUser(request);

    if (!user) {
      return createUnauthorizedResponse('Not authenticated');
    }

    const response: AuthResponse = {
      success: true,
      user: toPublicUser(user),
    };

    return Response.json(response);
  }
  catch (error) {
    console.error('Get current user error:', error);

    return Response.json(
      { success: false, error: 'Failed to get user information' },
      { status: 500 },
    );
  }
}
