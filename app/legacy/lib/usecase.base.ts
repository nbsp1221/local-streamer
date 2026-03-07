import { type Result } from './result';

export abstract class UseCase<TRequest, TResponse> {
  abstract execute(request: TRequest): Promise<Result<TResponse>>;
}
