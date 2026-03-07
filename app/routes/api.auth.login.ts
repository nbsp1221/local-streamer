import type { ActionFunctionArgs } from 'react-router';
import { createSessionCookieHeader, getServerAuthServices } from '~/composition/server/auth';

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

export async function action({ request }: ActionFunctionArgs): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    );
  }

  try {
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
      ipAddress:
        request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        request.headers.get('X-Real-IP') ||
        undefined,
      now: new Date(),
      password,
      userAgent: request.headers.get('User-Agent') || undefined,
    });

    if (!result.ok) {
      return Response.json(
        { success: false, error: 'Invalid password' },
        { status: 401 },
      );
    }

    return Response.json(
      {
        success: true,
        user: await authServices.toLegacyCompatibleUser(),
      },
      {
        headers: {
          'Set-Cookie': createSessionCookieHeader(result.session.id),
        },
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
