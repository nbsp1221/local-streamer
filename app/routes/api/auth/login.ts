import type { AuthResponse, LoginFormData } from '~/types/auth';
import { COOKIE_NAME, createSession, getCookieOptions, serializeCookie } from '~/services/session-store.server';
import { authenticateUser } from '~/services/user-store.server';
import { addLoginDelay, getClientIP, isValidEmail, toPublicUser } from '~/utils/auth.server';
import type { Route } from './+types/login';

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json(
      { success: false, error: 'Method not allowed' },
      { status: 405 },
    );
  }

  try {
    // Parse request data
    const formData: LoginFormData = await request.json();
    const { email, password } = formData;

    // Validate input values
    if (!email || !password) {
      await addLoginDelay();
      return Response.json(
        { success: false, error: 'Email and password are required' },
        { status: 400 },
      );
    }

    // Validate email format
    if (!isValidEmail(email)) {
      await addLoginDelay();
      return Response.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 },
      );
    }

    // Authenticate user
    const user = await authenticateUser(email, password);

    if (!user) {
      // Add delay on failure (brute force attack protection)
      await addLoginDelay();
      return Response.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 },
      );
    }

    console.log(`✅ User logged in: ${user.email} (${user.id})`);

    // Extract User-Agent and IP address
    const userAgent = request.headers.get('User-Agent') || undefined;
    const ipAddress = getClientIP(request);

    // Create new session
    const session = await createSession(user.id, userAgent, ipAddress);

    // Set cookie
    const cookieOptions = getCookieOptions();
    const cookieString = serializeCookie(COOKIE_NAME, session.id, cookieOptions);

    // Return JSON response (with cookie)
    return Response.json(
      {
        success: true,
        user: toPublicUser(user),
      },
      {
        headers: {
          'Set-Cookie': cookieString,
        },
      },
    );
  }
  catch (error) {
    console.error('Login error:', error);

    // Add delay even on error
    await addLoginDelay();

    return Response.json(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 },
    );
  }
}
