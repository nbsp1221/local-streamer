export class IngestProcessingError extends Error {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;

  constructor(message: string) {
    super(message);
    this.name = 'IngestProcessingError';
  }
}
