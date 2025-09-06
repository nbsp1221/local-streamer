import { UnauthorizedError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type ValidateVideoTokenDependencies,
  type ValidateVideoTokenRequest,
  type ValidateVideoTokenResponse,
  type VideoTokenPayload,
} from './validate-token.types';

export class ValidateVideoTokenUseCase extends UseCase<ValidateVideoTokenRequest, ValidateVideoTokenResponse> {
  constructor(private readonly deps: ValidateVideoTokenDependencies) {
    super();
  }

  async execute(request: ValidateVideoTokenRequest): Promise<Result<ValidateVideoTokenResponse>> {
    try {
      // 1. Validate input
      const validation = this.validateInput(request);
      if (!validation.success) {
        return validation;
      }

      const { token, expectedVideoId, ipAddress, userAgent } = request;
      const { jwt, config, logger } = this.deps;

      // 2. Verify token signature and expiry
      let decoded: VideoTokenPayload;
      try {
        decoded = jwt.verify(token, config.jwtSecret, {
          issuer: config.jwtIssuer,
          audience: config.jwtAudience,
        }) as VideoTokenPayload;
      }
      catch (error) {
        let errorMessage = 'Invalid token';

        if (error instanceof jwt.TokenExpiredError) {
          errorMessage = 'Token expired';
        }
        else if (error instanceof jwt.JsonWebTokenError) {
          errorMessage = 'Invalid token signature';
        }

        logger?.warn('JWT token validation failed', { error: errorMessage });
        return Result.fail(new UnauthorizedError(errorMessage));
      }

      // 3. Check video ID if specified
      if (expectedVideoId && decoded.videoId !== expectedVideoId) {
        logger?.warn('JWT token video ID mismatch', {
          expected: expectedVideoId,
          actual: decoded.videoId,
        });
        return Result.fail(new UnauthorizedError('Token not valid for this video'));
      }

      // 4. Optional: Strict IP validation (can be disabled for flexibility)
      if (decoded.ip && ipAddress && decoded.ip !== ipAddress) {
        logger?.warn(`Video token IP mismatch: expected ${decoded.ip}, got ${ipAddress}`);
        // For now, only warn - strict validation can be enabled later
        // return Result.fail(new UnauthorizedError('IP address mismatch'));
      }

      // 5. Optional: User-Agent validation (can be disabled for flexibility)
      if (decoded.userAgent && userAgent && decoded.userAgent !== userAgent) {
        logger?.warn('Video token User-Agent mismatch');
        // For now, only warn - strict validation can be enabled later
        // return Result.fail(new UnauthorizedError('User-Agent mismatch'));
      }

      logger?.info('JWT token validated successfully', {
        videoId: decoded.videoId,
        userId: decoded.userId,
      });

      return Result.ok({
        valid: true,
        payload: decoded,
      });
    }
    catch (error) {
      this.deps.logger?.error('Unexpected error during token validation', error);
      return Result.fail(new UnauthorizedError('Token validation failed'));
    }
  }

  private validateInput(request: ValidateVideoTokenRequest): Result<void> {
    if (!request.token?.trim()) {
      return Result.fail(new ValidationError('Token is required'));
    }

    return Result.ok(undefined);
  }
}
