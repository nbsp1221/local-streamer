import { InternalError, NotFoundError, UnauthorizedError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import { validateVideoRequest } from '~/services/video-jwt.server';
import type {
  GetManifestRequest,
  GetManifestResult,
} from './manifest.types';
import { ManifestError } from './manifest.types';
import { videoManifestService } from './VideoManifestService';

export interface GetManifestDependencies {
  manifestService: typeof videoManifestService;
  jwtValidator?: typeof validateVideoRequest;
  logger?: {
    info: (message: string, meta?: any) => void;
    warn: (message: string, meta?: any) => void;
    error: (message: string, error?: any) => void;
  };
}

/**
 * Use case for getting DASH manifest content
 * Handles JWT validation, manifest retrieval, and proper HTTP headers
 */
export class GetManifestUseCase extends UseCase<GetManifestRequest, GetManifestResult> {
  constructor(private readonly deps: GetManifestDependencies) {
    super();
  }

  async execute(request: GetManifestRequest): Promise<Result<GetManifestResult>> {
    try {
      // 1. Validate input
      const validation = this.validateInput(request);
      if (!validation.success) {
        return validation;
      }

      const { videoId, validateToken = true } = request;

      // 2. Validate JWT Token if required (default: true)
      if (validateToken && this.deps.jwtValidator) {
        // JWT validation would be done at route level, but we can add additional validation here if needed
        this.deps.logger?.info(`Manifest request for video: ${videoId}`, {
          videoId,
          validateToken,
        });
      }

      // 3. Check if video manifest is available
      const availability = await this.deps.manifestService.isManifestAvailable(videoId);
      if (!availability.available) {
        this.deps.logger?.warn(`Manifest not available for video ${videoId}`, {
          videoId,
          reason: availability.reason,
        });

        const errorMessage = this.getErrorMessageForReason(availability.reason);
        return Result.fail(new NotFoundError(errorMessage));
      }

      // 4. Get manifest content
      const manifestResult = await this.deps.manifestService.getManifestContent(videoId);
      if (!manifestResult.success) {
        this.deps.logger?.error(`Failed to get manifest content for video ${videoId}`, manifestResult.error);

        // Map ManifestError to appropriate HTTP error
        return Result.fail(this.mapManifestErrorToHttpError(manifestResult.error));
      }

      // 5. Create response with proper headers
      const manifestContent = manifestResult.data.content;
      const headers = this.createManifestHeaders(manifestResult.data.size);

      // 6. Log successful manifest delivery
      this.deps.logger?.info(`DASH manifest served successfully`, {
        videoId,
        contentSize: manifestResult.data.size,
      });

      return Result.ok({
        manifestContent,
        headers,
      });
    }
    catch (error) {
      this.deps.logger?.error('GetManifest UseCase failed with unexpected error', error);

      return Result.fail(
        new InternalError('Failed to load DASH manifest'),
      );
    }
  }

  private validateInput(request: GetManifestRequest): Result<void> {
    if (!request.videoId || typeof request.videoId !== 'string' || request.videoId.trim().length === 0) {
      return Result.fail(new ValidationError('Video ID is required'));
    }

    // Basic video ID format validation (assuming UUID format)
    const videoIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (!videoIdPattern.test(request.videoId)) {
      return Result.fail(new ValidationError('Invalid video ID format'));
    }

    return Result.ok(undefined);
  }

  private getErrorMessageForReason(reason?: string): string {
    switch (reason) {
      case 'manifest_not_found':
        return 'Video manifest not found';
      case 'key_not_found':
        return 'Video encryption key not found';
      case 'workspace_not_found':
        return 'Video not found';
      case 'invalid_video_id':
        return 'Invalid video ID';
      default:
        return 'Video not available';
    }
  }

  private mapManifestErrorToHttpError(error: ManifestError): Error {
    switch (error.code) {
      case 'VIDEO_NOT_FOUND':
      case 'MANIFEST_NOT_FOUND':
      case 'KEY_NOT_FOUND':
      case 'SEGMENT_NOT_FOUND':
        return new NotFoundError(error.message);
      case 'INVALID_SEGMENT_NAME':
        return new ValidationError(error.message);
      case 'WORKSPACE_ERROR':
      case 'FILE_READ_ERROR':
      default:
        return new InternalError('Failed to process manifest request');
    }
  }

  private createManifestHeaders(contentSize?: number): { 'Content-Type': string; 'Content-Length'?: string } & Record<string, string> {
    const headers = {
      'Content-Type': 'application/dash+xml',

      // Allow CORS for video streaming
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',

      // Security headers
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',

      // Cache manifest for performance (short duration)
      'Cache-Control': 'public, max-age=60', // 1 minute cache
    };

    if (contentSize !== undefined) {
      return {
        ...headers,
        'Content-Length': contentSize.toString(),
      };
    }

    return headers;
  }
}

// Create default dependencies
const createDefaultDependencies = (): GetManifestDependencies => ({
  manifestService: videoManifestService,
  jwtValidator: validateVideoRequest,
  logger: {
    info: (message: string, meta?: any) => console.log(`ℹ️ [GetManifest] ${message}`, meta || ''),
    warn: (message: string, meta?: any) => console.warn(`⚠️ [GetManifest] ${message}`, meta || ''),
    error: (message: string, error?: any) => console.error(`❌ [GetManifest] ${message}`, error || ''),
  },
});

// Export configured use case instance
export const getManifestUseCase = new GetManifestUseCase(createDefaultDependencies());
