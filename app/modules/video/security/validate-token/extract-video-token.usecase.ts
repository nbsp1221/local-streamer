import { Result } from '~/lib/result';
import { UseCase } from '~/lib/usecase.base';
import {
  type ExtractVideoTokenRequest,
  type ExtractVideoTokenResponse,
} from './validate-token.types';

export class ExtractVideoTokenUseCase {
  execute(request: ExtractVideoTokenRequest): Result<ExtractVideoTokenResponse> {
    const { request: httpRequest } = request;

    // 1. Check query parameter (preferred for video streaming)
    const url = new URL(httpRequest.url);
    const queryToken = url.searchParams.get('token');
    if (queryToken) {
      return Result.ok({ token: queryToken });
    }

    // 2. Check Authorization header (fallback)
    const authHeader = httpRequest.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      return Result.ok({ token });
    }

    return Result.ok({ token: null });
  }
}
