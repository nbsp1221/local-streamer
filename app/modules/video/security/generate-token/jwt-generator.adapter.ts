import jwt from 'jsonwebtoken';
import { config } from '~/configs';
import { GenerateVideoTokenUseCase } from './generate-token.usecase';

/**
 * Adapter that provides the same interface as the legacy generateVideoToken function
 * but uses the new UseCase pattern internally
 */
export class JwtGeneratorAdapter {
  private readonly generateTokenUseCase: GenerateVideoTokenUseCase;

  constructor() {
    this.generateTokenUseCase = new GenerateVideoTokenUseCase({
      jwt: {
        sign: jwt.sign,
      },
      config: {
        jwtSecret: config.security.video.auth.secret,
        jwtIssuer: 'local-streamer',
        jwtAudience: 'video-streaming',
        jwtExpiry: '15m', // 15 minutes expiry for video tokens
      },
      logger: console,
    });
  }

  /**
   * Generate video access token for a specific video
   * Compatible with legacy generateVideoToken function
   */
  async generateVideoToken(
    videoId: string,
    userId: string,
    ip?: string,
    userAgent?: string,
  ): Promise<string> {
    const result = await this.generateTokenUseCase.execute({
      videoId,
      userId,
      ipAddress: ip,
      userAgent,
    });

    if (result.success) {
      return result.data.token;
    }

    throw new Error(result.error.message);
  }
}
