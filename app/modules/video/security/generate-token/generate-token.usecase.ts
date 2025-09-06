import { ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type GenerateVideoTokenDependencies,
  type GenerateVideoTokenRequest,
  type GenerateVideoTokenResponse,
} from './generate-token.types';

export class GenerateVideoTokenUseCase extends UseCase<GenerateVideoTokenRequest, GenerateVideoTokenResponse> {
  constructor(private readonly deps: GenerateVideoTokenDependencies) {
    super();
  }

  async execute(request: GenerateVideoTokenRequest): Promise<Result<GenerateVideoTokenResponse>> {
    try {
      // 1. Validate input
      const validation = this.validateInput(request);
      if (!validation.success) {
        return validation;
      }

      const { videoId, userId, ipAddress, userAgent } = request;
      const { jwt, config, logger } = this.deps;

      // 2. Create payload
      const payload = {
        videoId,
        userId,
        ...(ipAddress && { ip: ipAddress }),
        ...(userAgent && { userAgent }),
      };

      // 3. Sign token
      const token = jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiry,
        issuer: config.jwtIssuer,
        audience: config.jwtAudience,
      });

      logger?.info(`Generated video token for video ${videoId}, user ${userId}`);

      return Result.ok({
        token,
      });
    }
    catch (error) {
      this.deps.logger?.error('Failed to generate video token', error);
      return Result.fail(new ValidationError('Failed to generate token'));
    }
  }

  private validateInput(request: GenerateVideoTokenRequest): Result<void> {
    if (!request.videoId?.trim()) {
      return Result.fail(new ValidationError('Video ID is required'));
    }

    if (!request.userId?.trim()) {
      return Result.fail(new ValidationError('User ID is required'));
    }

    return Result.ok(undefined);
  }
}
