import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import type { LogoutRequest } from '~/modules/auth/logout/logout.types';
import { cookieManager } from '~/lib/cookie';
import { DomainError } from '~/lib/errors';
import { LogoutUseCase } from '~/modules/auth/logout/logout.usecase';
import { getSessionRepository } from '~/repositories';

// Create UseCase with dependencies
function createLogoutUseCase() {
  return new LogoutUseCase({
    sessionRepository: getSessionRepository(),
    cookieManager: {
      getDeleteString: cookieManager.getDeleteString.bind(cookieManager),
      cookieName: cookieManager.cookieName,
    },
    logger: console,
  });
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    );
  }

  try {
    // Check redirectTo parameter
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo') || '/login';

    // Extract session ID from cookies
    const sessionId = cookieManager.extractSessionId(request);

    const logoutRequest: LogoutRequest = {
      sessionId: sessionId || undefined,
      redirectTo,
    };

    // Create UseCase and execute
    const logoutUseCase = createLogoutUseCase();
    const result = await logoutUseCase.execute(logoutRequest);

    if (result.success) {
      console.log('🚪 User logged out');

      return redirect(result.data.redirectTo, {
        headers: {
          'Set-Cookie': result.data.cookieString,
        },
      });
    }
    else {
      // Handle UseCase errors (should be rare for logout)
      console.error('Logout error:', result.error);

      // Fallback: still clear cookie and redirect
      return redirect('/login', {
        headers: {
          'Set-Cookie': cookieManager.getDeleteString(cookieManager.cookieName),
        },
      });
    }
  }
  catch (error) {
    console.error('Logout error:', error);

    // Fallback: still clear cookie and redirect
    return redirect('/login', {
      headers: {
        'Set-Cookie': cookieManager.getDeleteString(cookieManager.cookieName),
      },
    });
  }
}

// Also supports GET requests (direct logout via URL)
export async function loader({ request }: LoaderFunctionArgs): Promise<Response> {
  try {
    // Extract session ID from cookies
    const sessionId = cookieManager.extractSessionId(request);

    const logoutRequest: LogoutRequest = {
      sessionId: sessionId || undefined,
      redirectTo: '/login',
    };

    // Create UseCase and execute
    const logoutUseCase = createLogoutUseCase();
    const result = await logoutUseCase.execute(logoutRequest);

    console.log('🚪 User logged out (GET)');

    if (result.success) {
      return redirect(result.data.redirectTo, {
        headers: {
          'Set-Cookie': result.data.cookieString,
        },
      });
    }
    else {
      // Fallback: still clear cookie and redirect
      return redirect('/login', {
        headers: {
          'Set-Cookie': cookieManager.getDeleteString(cookieManager.cookieName),
        },
      });
    }
  }
  catch (error) {
    console.error('Logout error:', error);

    // Fallback: still clear cookie and redirect
    return redirect('/login', {
      headers: {
        'Set-Cookie': cookieManager.getDeleteString(cookieManager.cookieName),
      },
    });
  }
}
