export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
    this.name = 'UnauthorizedError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string) {
    super(`${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}

export class InternalError extends DomainError {
  constructor(message: string) {
    super(message, 'INTERNAL_ERROR', 500);
    this.name = 'InternalError';
  }
}

// Video Processing Errors
export abstract class VideoProcessingError extends DomainError {}

export class InvalidVideoFileError extends VideoProcessingError {
  constructor(reason: string) {
    super(`Invalid video file: ${reason}`, 'INVALID_VIDEO_FILE', 400);
    this.name = 'InvalidVideoFileError';
  }
}

export class TranscodingEngineError extends VideoProcessingError {
  constructor(details: string) {
    super(`The video processing engine failed. Details: ${details}`, 'TRANSCODING_ENGINE_FAILURE', 500);
    this.name = 'TranscodingEngineError';
  }
}

export class ResourceNotFoundError extends VideoProcessingError {
  constructor(resource: string) {
    super(`Required resource not found: ${resource}`, 'RESOURCE_NOT_FOUND', 404);
    this.name = 'ResourceNotFoundError';
  }
}

export class VideoProcessingTimeoutError extends VideoProcessingError {
  constructor(operation: string, timeoutMs: number) {
    super(`Video processing timeout: ${operation} exceeded ${timeoutMs}ms`, 'VIDEO_PROCESSING_TIMEOUT', 408);
    this.name = 'VideoProcessingTimeoutError';
  }
}

export class UnsupportedVideoFormatError extends VideoProcessingError {
  constructor(format: string) {
    super(`Unsupported video format: ${format}`, 'UNSUPPORTED_VIDEO_FORMAT', 415);
    this.name = 'UnsupportedVideoFormatError';
  }
}
