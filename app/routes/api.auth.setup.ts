import type { ActionFunctionArgs } from 'react-router';
import type { SetupUserRequest } from '~/modules/auth/setup-user/setup-user.types';
import type { SetupFormData } from '~/types/auth';
import { cookieManager } from '~/lib/cookie';
import { DomainError } from '~/lib/errors';
import { SetupUserUseCase } from '~/modules/auth/setup-user/setup-user.usecase';
import { getSessionRepository, getUserRepository } from '~/repositories';
import { addLoginDelay, getClientIP, isValidEmail, isValidPassword, toPublicUser } from '~/utils/auth.server';

// Create UseCase with dependencies
function createSetupUserUseCase() {
  const userRepository = getUserRepository();

  return new SetupUserUseCase({
    userRepository,
    sessionRepository: getSessionRepository(),
    sessionManager: {
      createSession: (userId: string, userAgent?: string, ipAddress?: string) => getSessionRepository().create({ userId, userAgent, ipAddress }),
      getCookieOptions: cookieManager.getCookieOptions.bind(cookieManager),
      serializeCookie: cookieManager.serialize.bind(cookieManager),
      cookieName: cookieManager.cookieName,
    },
    securityService: {
      isValidEmail,
      isValidPassword,
      addLoginDelay,
      getClientIP,
      toPublicUser,
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
    // Parse request data
    const formData: SetupFormData = await request.json();
    const { email, password } = formData;

    // Extract User-Agent and IP address for session creation
    const userAgent = request.headers.get('User-Agent') || undefined;
    const ipAddress = getClientIP(request);

    const setupRequest: SetupUserRequest = {
      email,
      password,
      userAgent,
      ipAddress,
    };

    // Create UseCase and execute
    const setupUseCase = createSetupUserUseCase();
    const result = await setupUseCase.execute(setupRequest);

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
    console.error('Setup error:', error);

    // Add security delay on any error
    await addLoginDelay();

    return Response.json(
      { success: false, error: 'Failed to create admin user' },
      { status: 500 },
    );
  }
}
