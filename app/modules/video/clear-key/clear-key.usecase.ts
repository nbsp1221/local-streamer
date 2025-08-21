import { InternalError, NotFoundError, UnauthorizedError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type ClearKeyDependencies,
  type ClearKeyRequest,
  type ClearKeyResponse,
} from './clear-key.types';

export class ClearKeyUseCase extends UseCase<ClearKeyRequest, ClearKeyResponse> {
  constructor(private readonly deps: ClearKeyDependencies) {
    super();
  }

  async execute(request: ClearKeyRequest): Promise<Result<ClearKeyResponse>> {
    try {
      // 1. Validate input
      const validation = this.validateInput(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Validate JWT Token for key delivery (CRITICAL security check)
      const tokenValidation = await this.deps.jwtValidator.validateVideoRequest(
        request.request,
        request.videoId,
      );

      if (!tokenValidation.valid) {
        this.deps.logger?.warn(`Clear Key license access denied for ${request.videoId}`, {
          error: tokenValidation.error,
          videoId: request.videoId,
        });
        return Result.fail(new UnauthorizedError(tokenValidation.error || 'Token validation failed'));
      }

      // 3. Check if encryption key exists for this video
      const hasKey = await this.deps.keyManager.hasVideoKey(request.videoId);
      if (!hasKey) {
        this.deps.logger?.warn(`Encryption key not found for video ${request.videoId}`);
        return Result.fail(new NotFoundError('Encryption key'));
      }

      // 4. Get the encryption key
      const key = await this.deps.keyManager.getVideoKey(request.videoId);
      const keyHex = key.toString('hex');

      // 5. Generate consistent key ID for this video
      const keyId = this.deps.keyUtils.generateKeyId(request.videoId);

      // 6. Convert to base64url format (required by Clear Key spec)
      const keyIdBase64Url = this.deps.keyUtils.hexToBase64Url(keyId);
      const keyBase64Url = this.deps.keyUtils.hexToBase64Url(keyHex);

      // 7. Create Clear Key license response
      const clearKeyResponse = {
        keys: [
          {
            kty: 'oct',
            kid: keyIdBase64Url,
            k: keyBase64Url,
          },
        ],
        type: 'temporary',
      };

      // 8. Create security headers (CRITICAL: prevent key caching)
      const headers = this.createSecurityHeaders();

      // 9. Log key access for security monitoring
      const userId = tokenValidation.payload?.userId || 'unknown';
      this.deps.logger?.info(`Clear Key license delivered for video: ${request.videoId}`, {
        videoId: request.videoId,
        userId,
        keyId,
      });

      return Result.ok({
        success: true,
        clearKeyResponse,
        headers,
      });
    }
    catch (error) {
      this.deps.logger?.error('Clear Key UseCase failed with unexpected error', error);

      // Don't leak information about why the key request failed
      return Result.fail(
        new InternalError('Clear Key license access denied'),
      );
    }
  }

  private validateInput(request: ClearKeyRequest): Result<void> {
    if (!request.videoId || typeof request.videoId !== 'string' || request.videoId.trim().length === 0) {
      return Result.fail(new ValidationError('Video ID is required'));
    }

    if (!request.request || typeof request.request !== 'object') {
      return Result.fail(new ValidationError('Request object is required'));
    }

    return Result.ok(undefined);
  }

  private createSecurityHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',

      // CRITICAL SECURITY: Prevent caching of encryption keys
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',

      // Allow CORS for EME requests
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'false',
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',

      // Security headers
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    };
  }
}
