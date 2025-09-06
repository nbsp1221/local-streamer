import jwt from 'jsonwebtoken';
import { config } from '~/configs';
import type { VideoTokenPayload } from './validate-token.types';
import { ExtractVideoTokenUseCase } from './extract-video-token.usecase';
import { IpExtractorAdapter } from './ip-extractor.adapter';
import { ValidateVideoTokenUseCase } from './validate-token.usecase';
import { ValidateVideoRequestUseCase } from './validate-video-request.usecase';

/**
 * Adapter that provides the same interface as the legacy video-jwt.server.ts
 * but uses the new UseCase pattern internally
 */
export class JwtValidatorAdapter {
  private readonly validateTokenUseCase: ValidateVideoTokenUseCase;
  private readonly extractTokenUseCase: ExtractVideoTokenUseCase;
  private readonly validateRequestUseCase: ValidateVideoRequestUseCase;
  private readonly ipExtractor: IpExtractorAdapter;

  constructor() {
    this.ipExtractor = new IpExtractorAdapter();
    this.extractTokenUseCase = new ExtractVideoTokenUseCase();

    this.validateTokenUseCase = new ValidateVideoTokenUseCase({
      jwt: {
        verify: jwt.verify,
        TokenExpiredError: jwt.TokenExpiredError,
        JsonWebTokenError: jwt.JsonWebTokenError,
      },
      config: {
        jwtSecret: config.security.video.auth.secret,
        jwtIssuer: 'local-streamer',
        jwtAudience: 'video-streaming',
      },
      logger: console,
    });

    this.validateRequestUseCase = new ValidateVideoRequestUseCase({
      tokenExtractor: {
        extractVideoToken: this.extractVideoToken.bind(this),
      },
      tokenValidator: {
        validateVideoToken: this.validateVideoToken.bind(this),
      },
      ipExtractor: {
        getClientIP: this.ipExtractor.getClientIP.bind(this.ipExtractor),
      },
    });
  }

  /**
   * Extract token from request (query parameter or Authorization header)
   * Compatible with legacy extractVideoToken function
   */
  extractVideoToken(request: Request): string | null {
    // Use UseCase internally but return synchronously
    const result = this.extractTokenUseCase.execute({ request });
    return result.success ? result.data.token : null;
  }

  /**
   * Validate video access token
   * Compatible with legacy validateVideoToken function
   */
  async validateVideoToken(
    token: string,
    expectedVideoId?: string,
    ip?: string,
    userAgent?: string,
  ): Promise<{
    valid: boolean;
    payload?: VideoTokenPayload;
    error?: string;
  }> {
    const result = await this.validateTokenUseCase.execute({
      token,
      expectedVideoId,
      ipAddress: ip,
      userAgent,
    });

    if (result.success) {
      return {
        valid: true,
        payload: result.data.payload,
      };
    }

    return {
      valid: false,
      error: result.error.message,
    };
  }

  /**
   * Validate video request with token
   * Compatible with legacy validateVideoRequest function
   */
  async validateVideoRequest(
    request: Request,
    expectedVideoId?: string,
  ): Promise<{
    valid: boolean;
    payload?: VideoTokenPayload;
    error?: string;
  }> {
    const result = await this.validateRequestUseCase.execute({
      request,
      expectedVideoId,
    });

    if (result.success) {
      return {
        valid: true,
        payload: result.data.payload,
      };
    }

    return {
      valid: false,
      error: result.error.message,
    };
  }
}
