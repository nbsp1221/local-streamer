import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import {
  createClearedSessionCookieHeader,
  getServerAuthServices,
  getSiteSessionId,
} from '~/composition/server/auth';
import { getSafeRedirectTarget } from '~/shared/lib/http/redirects.server';

function getLogoutRedirectTo(request: Request): string {
  return getSafeRedirectTarget(request, '/login');
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    );
  }

  try {
    const authServices = getServerAuthServices();

    await authServices.destroyAuthSession.execute({
      sessionId: getSiteSessionId(request),
    });

    return redirect(getLogoutRedirectTo(request), {
      headers: {
        'Set-Cookie': createClearedSessionCookieHeader(),
      },
    });
  }
  catch (error) {
    console.error('Logout error:', error);
    return redirect('/login', {
      headers: {
        'Set-Cookie': createClearedSessionCookieHeader(),
      },
    });
  }
}

// Also supports GET requests (direct logout via URL)
export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  try {
    const authServices = getServerAuthServices();
    await authServices.destroyAuthSession.execute({
      sessionId: getSiteSessionId(request),
    });

    return redirect(getLogoutRedirectTo(request), {
      headers: {
        'Set-Cookie': createClearedSessionCookieHeader(),
      },
    });
  }
  catch (error) {
    console.error('Logout error:', error);
    return redirect('/login', {
      headers: {
        'Set-Cookie': createClearedSessionCookieHeader(),
      },
    });
  }
}
