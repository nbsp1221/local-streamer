import type { LoginRequest } from '~/modules/auth/login/login.types';
import type { LoginFormData } from '~/types/auth';
import { DomainError } from '~/lib/errors';
import { LoginUseCase } from '~/modules/auth/login/login.usecase';
import { getSessionRepository } from '~/repositories';
import { authenticateUser } from '~/services/user-store.server';
import { addLoginDelay, getClientIP, isValidEmail } from '~/utils/auth.server';
import type { Route } from './+types/login';

// Create UseCase with dependencies
function createLoginUseCase() {
  const userRepository = {
    authenticateUser,
  };

  const sessionRepository = {
    createSession: (userId: string, userAgent?: string, ipAddress?: string) => getSessionRepository().create({ userId, userAgent, ipAddress }),
  };

  return new LoginUseCase({
    userRepository,
    sessionRepository,
    logger: console,
    addLoginDelay,
    isValidEmail,
  });
}

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

    // Extract User-Agent and IP address for session creation
    const userAgent = request.headers.get('User-Agent') || undefined;
    const ipAddress = getClientIP(request);

    const loginRequest: LoginRequest = {
      email,
      password,
      userAgent,
      ipAddress,
    };

    // Create UseCase and execute
    const loginUseCase = createLoginUseCase();
    const result = await loginUseCase.execute(loginRequest);

    if (result.success) {
      // Return success response with cookie from UseCase
      return Response.json(
        {
          success: true,
          user: result.data.user,
        },
        {
          headers: {
            'Set-Cookie': result.data.cookieString,
          },
        },
      );
    }
    else {
      // Handle UseCase errors
      const statusCode = result.error instanceof DomainError ? result.error.statusCode : 500;
      return Response.json(
        { success: false, error: result.error.message },
        { status: statusCode },
      );
    }
  }
  catch (error) {
    console.error('Login error:', error);

    // Add security delay on any error
    await addLoginDelay();

    return Response.json(
      { success: false, error: 'Login failed. Please try again.' },
      { status: 500 },
    );
  }
}
