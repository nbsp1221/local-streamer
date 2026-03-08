import type { LoaderFunctionArgs } from 'react-router';
import { getOptionalLegacyCompatibleUser } from '~/composition/server/auth';
import { getAuthRuntimeState } from '~/shared/config/auth.server';
export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  try {
    if (!getAuthRuntimeState().isConfigured) {
      return Response.json(
        { success: false, error: 'Authentication is not configured' },
        { status: 503 },
      );
    }

    const user = await getOptionalLegacyCompatibleUser(request);

    if (!user) {
      return Response.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 },
      );
    }

    return Response.json({
      success: true,
      user,
    });
  }
  catch (error) {
    console.error('Get current user error:', error);

    return Response.json(
      { success: false, error: 'Failed to get user information' },
      { status: 500 },
    );
  }
}
