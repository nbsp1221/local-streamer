import { cookieManager } from '~/lib/cookie';
import { InternalError, UnauthorizedError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import { toPublicUser } from '~/utils/auth.server';
import {
  type LoginDependencies,
  type LoginRequest,
  type LoginResponse,
} from './login.types';

export class LoginUseCase extends UseCase<LoginRequest, LoginResponse> {
  constructor(private readonly deps: LoginDependencies) {
    super();
  }

  async execute(request: LoginRequest): Promise<Result<LoginResponse>> {
    try {
      // 1. Validate input
      const validation = this.validateInput(request);
      if (!validation.success) {
        await this.deps.addLoginDelay();
        return validation;
      }

      // 2. Validate email format
      if (!this.deps.isValidEmail(request.email)) {
        await this.deps.addLoginDelay();
        return Result.fail(new ValidationError('Invalid email format'));
      }

      // 3. Authenticate user
      const user = await this.deps.userRepository.authenticate(request.email, request.password);
      if (!user) {
        await this.deps.addLoginDelay();
        this.deps.logger?.warn('Login attempt with invalid credentials', {
          email: request.email,
          ip: request.ipAddress,
        });
        return Result.fail(new UnauthorizedError('Invalid email or password'));
      }

      // 4. Create session
      const session = await this.deps.sessionRepository.createSession(
        user.id,
        request.userAgent,
        request.ipAddress,
      );

      // 5. Create cookie string
      const cookieString = cookieManager.serialize(
        cookieManager.cookieName,
        session.id,
        cookieManager.getCookieOptions(),
      );

      this.deps.logger?.info('User logged in successfully', {
        userId: user.id,
        email: user.email,
        sessionId: session.id,
        ip: request.ipAddress,
      });

      return Result.ok({
        success: true,
        user: toPublicUser(user),
        sessionId: session.id,
        cookieString,
      });
    }
    catch (error) {
      this.deps.logger?.error('Login failed with unexpected error', error);
      await this.deps.addLoginDelay();
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Login failed',
        ),
      );
    }
  }

  private validateInput(request: LoginRequest): Result<void> {
    // Validate email
    if (!request.email || typeof request.email !== 'string' || request.email.trim().length === 0) {
      return Result.fail(new ValidationError('Email is required'));
    }

    // Validate password
    if (!request.password || typeof request.password !== 'string' || request.password.length === 0) {
      return Result.fail(new ValidationError('Password is required'));
    }

    return Result.ok(undefined);
  }
}
