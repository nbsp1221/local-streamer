import type { Result } from '~/lib/result';
import { DomainError } from '~/lib/errors';

/**
 * Type-safe error response utilities for API routes
 * Provides consistent error handling patterns across all route handlers
 */

/**
 * Extract HTTP status code from error in a type-safe manner
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof DomainError) {
    return error.statusCode;
  }
  return 500;
}

/**
 * Extract error message from error in a type-safe manner
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error occurred';
}

/**
 * Handle UseCase result errors consistently across API routes
 * Returns a Response.json() for failed results
 */
export function handleUseCaseResult<T>(result: Result<T>): Response | T {
  if (result.success) {
    return result.data;
  }

  const statusCode = getErrorStatusCode(result.error);
  const message = getErrorMessage(result.error);

  return Response.json({
    success: false,
    error: message,
  }, { status: statusCode });
}

/**
 * Create error response for API routes that need to throw Response
 * Used in loader functions and other contexts that need to throw
 */
export function createErrorResponse(error: unknown): Response {
  const statusCode = getErrorStatusCode(error);
  const message = getErrorMessage(error);

  return new Response(message, { status: statusCode });
}

/**
 * Handle UseCase result errors for routes that throw Response
 * Throws a Response for failed results, returns data for success
 */
export function handleUseCaseResultOrThrow<T>(result: Result<T>): T {
  if (result.success) {
    return result.data;
  }

  throw createErrorResponse(result.error);
}
