import { InternalError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type LogoutDependencies,
  type LogoutRequest,
  type LogoutResponse,
} from './logout.types';

/**
 * UseCase for handling user logout operations
 * Follows the established MVC + UseCase + Repository pattern
 */
export class LogoutUseCase extends UseCase<LogoutRequest, LogoutResponse> {
  constructor(private readonly deps: LogoutDependencies) {
    super();
  }

  /**
   * Execute logout operation
   */
  async execute(request: LogoutRequest): Promise<Result<LogoutResponse>> {
    try {
      const { sessionId, redirectTo = '/login' } = request;

      // Delete session if session ID is provided
      if (sessionId) {
        const deleteResult = await this.deleteSession(sessionId);
        if (!deleteResult.success) {
          // Log error but continue with logout (fail-safe approach)
          this.deps.logger?.error('Failed to delete session during logout', deleteResult.error);
        }
        else {
          this.deps.logger?.info('User logged out successfully', { sessionId });
        }
      }

      // Generate cookie delete string
      const cookieString = this.deps.cookieManager.getDeleteString(
        this.deps.cookieManager.cookieName,
      );

      return Result.ok({
        success: true,
        cookieString,
        redirectTo,
      });
    }
    catch (error) {
      this.deps.logger?.error('Logout failed with unexpected error', error);

      // Even if there's an error, we should still attempt to clear the cookie
      const cookieString = this.deps.cookieManager.getDeleteString(
        this.deps.cookieManager.cookieName,
      );

      // Return success for logout even on error (fail-safe approach)
      return Result.ok({
        success: true,
        cookieString,
        redirectTo: request.redirectTo || '/login',
      });
    }
  }

  /**
   * Delete session with error handling
   */
  private async deleteSession(sessionId: string): Promise<Result<void>> {
    try {
      const deleted = await this.deps.sessionRepository.delete(sessionId);

      if (!deleted) {
        return Result.fail(new InternalError('Session not found or already deleted'));
      }

      return Result.ok(undefined);
    }
    catch (error) {
      return Result.fail(
        new InternalError(
          error instanceof Error ? error.message : 'Failed to delete session',
        ),
      );
    }
  }
}
