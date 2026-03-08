import type { ActionFunctionArgs } from 'react-router';
import {
  createSessionCookieHeader,
  getServerAuthServices,
} from '~/composition/server/auth';
import {
  getAuthClientCookieHeaderForRequest,
  getLoginAttemptKeys,
  getTrustedClientIP,
} from '~/composition/server/auth-client-identity';
import { getAuthRuntimeState } from '~/shared/config/auth.server';

async function extractPassword(request: Request): Promise<string | null> {
  const contentType = request.headers.get('Content-Type') || '';

  if (contentType.includes('application/json')) {
    const body = await request.json() as { password?: string };
    return body.password?.trim() || null;
  }

  const formData = await request.formData();
  const password = formData.get('password');

  return typeof password === 'string' ? password.trim() : null;
}

function createLoginResponseHeaders(request: Request, additionalCookies: string[] = []): Headers | undefined {
  const headers = new Headers();
  const authClientCookie = getAuthClientCookieHeaderForRequest(request);

  if (authClientCookie) {
    headers.append('Set-Cookie', authClientCookie);
  }

  for (const cookie of additionalCookies) {
    headers.append('Set-Cookie', cookie);
  }

  return headers.keys().next().done ? undefined : headers;
}

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    );
  }

  try {
    const authRuntimeState = getAuthRuntimeState();

    if (!authRuntimeState.isConfigured) {
      return Response.json(
        { success: false, error: 'Shared-password auth is not configured' },
        { status: 503 },
      );
    }

    const password = await extractPassword(request);

    if (!password) {
      return Response.json(
        {
          success: false,
          error: 'Password is required',
        },
        { status: 400 },
      );
    }

    const authServices = getServerAuthServices();
    const result = await authServices.createAuthSession.execute({
      attemptKeys: getLoginAttemptKeys(request),
      ipAddress: getTrustedClientIP(request),
      now: new Date(),
      password,
      userAgent: request.headers.get('User-Agent') || undefined,
    });

    if (!result.ok) {
      if (result.reason === 'RATE_LIMITED') {
        return Response.json(
          { success: false, error: 'Too many login attempts. Try again later.' },
          {
            headers: (() => {
              const headers = createLoginResponseHeaders(request);

              if (!headers) {
                return {
                  'Retry-After': String(result.retryAfterSeconds),
                };
              }

              headers.set('Retry-After', String(result.retryAfterSeconds));
              return headers;
            })(),
            status: 429,
          },
        );
      }

      return Response.json(
        { success: false, error: 'Invalid password' },
        {
          headers: createLoginResponseHeaders(request),
          status: 401,
        },
      );
    }

    return Response.json(
      {
        success: true,
        user: await authServices.toLegacyCompatibleUser(),
      },
      {
        headers: createLoginResponseHeaders(request, [
          createSessionCookieHeader(result.session.id),
        ]),
      },
    );
  }
  catch (error) {
    console.error('Login error:', error);

    return Response.json(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 },
    );
  }
}
