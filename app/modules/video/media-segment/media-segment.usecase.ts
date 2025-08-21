import { InternalError, NotFoundError, UnauthorizedError, ValidationError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type MediaSegmentDependencies,
  type MediaSegmentRequest,
  type MediaSegmentResponse,
} from './media-segment.types';

export class MediaSegmentUseCase extends UseCase<MediaSegmentRequest, MediaSegmentResponse> {
  constructor(private readonly deps: MediaSegmentDependencies) {
    super();
  }

  async execute(request: MediaSegmentRequest): Promise<Result<MediaSegmentResponse>> {
    try {
      // 1. Validate input
      const validation = this.validateInput(request);
      if (!validation.success) {
        return validation;
      }

      // 2. Validate JWT Token for media access
      const tokenValidation = await this.deps.jwtValidator.validateVideoRequest(
        request.request,
        request.videoId,
      );

      if (!tokenValidation.valid) {
        this.deps.logger?.warn(`${request.mediaType} segment access denied`, {
          videoId: request.videoId,
          filename: request.filename,
          error: tokenValidation.error,
        });
        return Result.fail(new UnauthorizedError(tokenValidation.error || 'Token validation failed'));
      }

      // 3. Validate DASH segment filename
      if (!this.deps.dashUtils.isValidDashSegmentName(request.filename)) {
        return Result.fail(new ValidationError(`Invalid ${request.mediaType} segment name`));
      }

      // 4. Get segment file path
      const segmentPath = this.deps.pathResolver.getVideoSegmentPath(
        request.videoId,
        request.mediaType,
        request.filename,
      );

      // 5. Check if segment exists
      const exists = await this.deps.fileSystem.exists(segmentPath);
      if (!exists) {
        return Result.fail(new NotFoundError(`${request.mediaType} segment`));
      }

      // 6. Get file stats
      const fileStats = await this.deps.fileSystem.stat(segmentPath);

      // 7. Get proper Content-Type for DASH segment
      const contentType = this.deps.dashUtils.getDashContentType(request.filename, request.mediaType);

      // 8. Handle range requests for better streaming performance
      const range = request.request.headers.get('range');
      if (range) {
        const rangeResponse = this.deps.dashUtils.handleDashRangeRequest(
          segmentPath,
          range,
          fileStats.size,
          contentType,
        );

        this.deps.logger?.info(`${request.mediaType} segment served (range)`, {
          videoId: request.videoId,
          filename: request.filename,
          sizeKB: Math.round(fileStats.size / 1024),
          range,
        });

        // Convert Response to our format - this is a workaround since range handler returns Response
        return Result.ok({
          success: true,
          stream: rangeResponse.body!,
          headers: Object.fromEntries(rangeResponse.headers.entries()),
          isRangeResponse: true,
          statusCode: rangeResponse.status,
        });
      }

      // 9. Create read stream for the segment
      const stream = this.deps.fileSystem.createReadStream(segmentPath);

      // 10. Get appropriate headers and convert to Record<string, string>
      const headersInit = this.deps.dashUtils.getDashSegmentHeaders(contentType, fileStats.size);
      const headers = this.convertHeadersToRecord(headersInit);

      this.deps.logger?.info(`${request.mediaType} segment served`, {
        videoId: request.videoId,
        filename: request.filename,
        sizeKB: Math.round(fileStats.size / 1024),
      });

      return Result.ok({
        success: true,
        stream,
        headers,
      });
    }
    catch (error) {
      this.deps.logger?.error('Media Segment UseCase failed with unexpected error', error);

      return Result.fail(
        new InternalError(`Failed to load ${request.mediaType} segment`),
      );
    }
  }

  private validateInput(request: MediaSegmentRequest): Result<void> {
    if (!request.videoId || typeof request.videoId !== 'string' || request.videoId.trim().length === 0) {
      return Result.fail(new ValidationError('Video ID is required'));
    }

    if (!request.filename || typeof request.filename !== 'string' || request.filename.trim().length === 0) {
      return Result.fail(new ValidationError('Filename is required'));
    }

    if (!['audio', 'video'].includes(request.mediaType)) {
      return Result.fail(new ValidationError('Media type must be audio or video'));
    }

    if (!request.request || typeof request.request !== 'object') {
      return Result.fail(new ValidationError('Request object is required'));
    }

    return Result.ok(undefined);
  }

  private convertHeadersToRecord(headersInit: HeadersInit): Record<string, string> {
    if (headersInit instanceof Headers) {
      return Object.fromEntries(headersInit.entries());
    }
    if (Array.isArray(headersInit)) {
      return Object.fromEntries(headersInit);
    }
    return headersInit as Record<string, string>;
  }
}
