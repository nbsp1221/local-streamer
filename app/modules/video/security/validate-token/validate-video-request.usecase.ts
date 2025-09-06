import { UnauthorizedError } from '~/lib/errors';
import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type ValidateVideoRequestDependencies,
  type ValidateVideoRequestRequest,
  type ValidateVideoRequestResponse,
} from './validate-token.types';

export class ValidateVideoRequestUseCase extends UseCase<ValidateVideoRequestRequest, ValidateVideoRequestResponse> {
  constructor(private readonly deps: ValidateVideoRequestDependencies) {
    super();
  }

  async execute(request: ValidateVideoRequestRequest): Promise<Result<ValidateVideoRequestResponse>> {
    const { request: httpRequest, expectedVideoId } = request;
    const { tokenExtractor, tokenValidator, ipExtractor } = this.deps;

    // 1. Extract token from request
    const token = tokenExtractor.extractVideoToken(httpRequest);
    if (!token) {
      return Result.fail(new UnauthorizedError('No token provided'));
    }

    // 2. Extract IP and User-Agent for additional validation
    const ip = ipExtractor.getClientIP(httpRequest);
    const userAgent = httpRequest.headers.get('User-Agent') || undefined;

    // 3. Validate token
    const validation = await tokenValidator.validateVideoToken(token, expectedVideoId, ip, userAgent);

    if (!validation.valid) {
      return Result.fail(new UnauthorizedError(validation.error || 'Token validation failed'));
    }

    return Result.ok({
      valid: true,
      payload: validation.payload!,
    });
  }
}
