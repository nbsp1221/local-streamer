export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

export const Result = {
  ok: <T>(data: T): Result<T> => ({ success: true, data }),
  fail: <E>(error: E): Result<never, E> => ({ success: false, error }),
};
