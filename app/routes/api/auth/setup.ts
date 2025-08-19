import type { SetupUserRequest } from '~/modules/auth/setup-user/setup-user.types';
import type { SetupFormData, SetupResponse } from '~/types/auth';
import { DomainError } from '~/lib/errors';
import { SetupUserUseCase } from '~/modules/auth/setup-user/setup-user.usecase';
import { getSessionRepository } from '~/repositories';
import { COOKIE_NAME, createSession, getCookieOptions, serializeCookie } from '~/services/session-store.server';
import { createUser, hasAdminUser } from '~/services/user-store.server';
import { addLoginDelay, getClientIP, isValidEmail, isValidPassword, toPublicUser } from '~/utils/auth.server';
import type { Route } from './+types/setup';

// Create UseCase with dependencies
function createSetupUserUseCase() {
  return new SetupUserUseCase({
    userRepository: {
      hasAdminUser,
      create: createUser,
    } as any,
    sessionRepository: getSessionRepository(),
    sessionManager: {
      createSession,
      getCookieOptions,
      serializeCookie,
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

export async function loader(): Promise<Response> {
  try {
    const setupUseCase = createSetupUserUseCase();
    const result = await setupUseCase.checkSetupStatus();

    if (result.success) {
      const response: SetupResponse = {
        success: true,
        needsSetup: result.data.needsSetup,
      };
      return Response.json(response);
    }
    else {
      const statusCode = result.error instanceof DomainError ? result.error.statusCode : 500;
      return Response.json(
        { success: false, error: result.error.message },
        { status: statusCode },
      );
    }
  }
  catch (error) {
    console.error('Setup status check failed:', error);
    return Response.json(
      { success: false, error: 'Failed to check setup status' },
      { status: 500 },
    );
  }
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
    const formData: SetupFormData = await request.json();
    const { email, password } = formData;

    const setupRequest: SetupUserRequest = {
      email,
      password,
    };

    // Extract User-Agent and IP address for session creation
    const userAgent = request.headers.get('User-Agent') || undefined;
    const ipAddress = getClientIP(request);

    // Create UseCase and execute
    const setupUseCase = createSetupUserUseCase();
    const result = await setupUseCase.execute(setupRequest);

    if (result.success) {
      // Create session with request context
      const sessionResult = await setupUseCase.createUserSession(
        result.data.userId,
        userAgent,
        ipAddress,
      );

      if (!sessionResult.success) {
        const statusCode = sessionResult.error instanceof DomainError ? sessionResult.error.statusCode : 500;
        return Response.json(
          { success: false, error: sessionResult.error.message },
          { status: statusCode },
        );
      }

      // Set cookie
      const cookieOptions = getCookieOptions();
      const cookieString = serializeCookie(COOKIE_NAME, sessionResult.data.sessionId, cookieOptions);

      // Return success response with cookie
      return Response.json(
        {
          success: true,
          user: result.data.user,
        },
        {
          headers: {
            'Set-Cookie': cookieString,
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
