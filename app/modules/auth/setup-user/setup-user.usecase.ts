import { ConflictError, InternalError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type CheckSetupStatusResponse,
  type SetupUserDependencies,
  type SetupUserRequest,
  type SetupUserResponse,
} from './setup-user.types';

export class SetupUserUseCase extends UseCase<SetupUserRequest, SetupUserResponse> {
  constructor(private readonly deps: SetupUserDependencies) {
    super();
  }

  /**
   * Check if setup is needed (no admin user exists)
   */
  async checkSetupStatus(): Promise<Result<CheckSetupStatusResponse>> {
    try {
      const adminExists = await this.deps.userRepository.hasAdminUser();

      return Result.ok({
        needsSetup: !adminExists,
      });
    }
    catch (error) {
      this.deps.logger?.error('Failed to check setup status', error);
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to check setup status',
        ),
      );
    }
  }

  /**
   * Create admin user and establish session
   */
  async execute(request: SetupUserRequest): Promise<Result<SetupUserResponse>> {
    try {
      // 1. Validate admin doesn't already exist
      const adminExistsResult = await this.validateAdminNotExists();
      if (!adminExistsResult.success) {
        return adminExistsResult;
      }

      // 2. Validate input
      const inputValidation = this.validateInput(request);
      if (!inputValidation.success) {
        return inputValidation;
      }

      // 3. Create admin user
      const user = await this.createAdminUser(request);

      this.deps.logger?.info(`Admin user created: ${user.email} (${user.id})`);

      // 4. Create session and handle response data
      const sessionResult = await this.createUserSession(user.id);
      if (!sessionResult.success) {
        return sessionResult;
      }

      // 5. Return success response
      return Result.ok({
        userId: user.id,
        sessionId: sessionResult.data.sessionId,
        message: 'Admin user created successfully',
        user: this.deps.securityService.toPublicUser(user),
      });
    }
    catch (error) {
      this.deps.logger?.error('Setup error', error);

      // Add security delay on any error
      await this.deps.securityService.addLoginDelay();

      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to create admin user',
        ),
      );
    }
  }

  /**
   * Create session for the newly created user
   */
  async createUserSession(userId: string, userAgent?: string, ipAddress?: string): Promise<Result<{ sessionId: string }>> {
    try {
      const session = await this.deps.sessionManager.createSession(userId, userAgent, ipAddress);

      return Result.ok({
        sessionId: session.id,
      });
    }
    catch (error) {
      this.deps.logger?.error('Failed to create session', error);
      return Result.fail(new InternalError('Failed to create session'));
    }
  }

  private async validateAdminNotExists(): Promise<Result<void>> {
    const adminExists = await this.deps.userRepository.hasAdminUser();

    if (adminExists) {
      return Result.fail(new ConflictError('Admin user already exists'));
    }

    return Result.ok(undefined);
  }

  private validateInput(request: SetupUserRequest): Result<void> {
    const { email, password } = request;

    // Check required fields
    if (!email || !password) {
      return Result.fail(new ValidationError('Email and password are required'));
    }

    // Validate email format
    if (!this.deps.securityService.isValidEmail(email)) {
      return Result.fail(new ValidationError('Invalid email address'));
    }

    // Validate password strength
    const passwordValidation = this.deps.securityService.isValidPassword(password);
    if (!passwordValidation.valid) {
      return Result.fail(
        new ValidationError(passwordValidation.errors.join(', ')),
      );
    }

    return Result.ok(undefined);
  }

  private async createAdminUser(request: SetupUserRequest): Promise<any> {
    const { email, password } = request;

    return await this.deps.userRepository.create({
      email,
      password,
      role: 'admin',
    });
  }
}
