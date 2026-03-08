import { describe, expect, test, vi } from 'vitest';
import { CreateAuthSessionUseCase } from './create-auth-session.usecase';

describe('CreateAuthSessionUseCase', () => {
  test('creates a session for a valid shared password', async () => {
    const savedSessions: Array<{ id: string }> = [];
    const useCase = new CreateAuthSessionUseCase({
      createSessionId: () => 'session-1',
      passwordVerifier: {
        verify: async password => password === 'correct-password',
      },
      loginAttemptGuard: {
        evaluate: () => ({ allowed: true }),
        registerFailure: vi.fn(),
        reset: vi.fn(),
        runExclusive: async (_key, task) => task(),
      },
      sessionRepository: {
        findById: async () => null,
        revoke: async () => {},
        save: async (session) => {
          savedSessions.push(session);
        },
        touch: async () => {},
      },
      sessionTtlMs: 60_000,
    });

    const result = await useCase.execute({
      now: new Date('2026-03-07T00:00:00.000Z'),
      password: 'correct-password',
      userAgent: 'vitest',
    });

    expect(result.ok).toBe(true);
    expect(savedSessions).toHaveLength(1);
    expect(savedSessions[0]?.id).toBe('session-1');
  });

  test('rejects an invalid shared password', async () => {
    const save = vi.fn();
    const delayOnInvalidPassword = vi.fn(async () => {});
    const registerFailure = vi.fn();
    const useCase = new CreateAuthSessionUseCase({
      createSessionId: () => 'session-2',
      loginAttemptGuard: {
        evaluate: () => ({ allowed: true }),
        registerFailure,
        reset: vi.fn(),
        runExclusive: async (_key, task) => task(),
      },
      onInvalidPassword: delayOnInvalidPassword,
      passwordVerifier: {
        verify: async () => false,
      },
      sessionRepository: {
        findById: async () => null,
        revoke: async () => {},
        save,
        touch: async () => {},
      },
      sessionTtlMs: 60_000,
    });

    const result = await useCase.execute({
      now: new Date('2026-03-07T00:00:00.000Z'),
      password: 'wrong-password',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'INVALID_SHARED_PASSWORD',
    });
    expect(save).not.toHaveBeenCalled();
    expect(delayOnInvalidPassword).toHaveBeenCalledOnce();
    expect(registerFailure).toHaveBeenCalledWith({
      key: 'global',
      now: new Date('2026-03-07T00:00:00.000Z'),
    });
  });

  test('blocks shared-password login when the attempt guard denies the request', async () => {
    const verify = vi.fn();
    const evaluate = vi.fn(({ key }: { key: string }) => (key === 'anonymous'
      ? {
          allowed: false,
          retryAfterSeconds: 60,
        }
      : {
          allowed: true,
        }));
    const useCase = new CreateAuthSessionUseCase({
      createSessionId: () => 'session-3',
      loginAttemptGuard: {
        evaluate,
        registerFailure: vi.fn(),
        reset: vi.fn(),
        runExclusive: async (_key, task) => task(),
      },
      onInvalidPassword: vi.fn(async () => {}),
      passwordVerifier: {
        verify,
      },
      sessionRepository: {
        findById: async () => null,
        revoke: async () => {},
        save: async () => {},
        touch: async () => {},
      },
      sessionTtlMs: 60_000,
    });

    const result = await useCase.execute({
      attemptKeys: ['client:rotated', 'anonymous'],
      now: new Date('2026-03-07T00:00:00.000Z'),
      password: 'wrong-password',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'RATE_LIMITED',
      retryAfterSeconds: 60,
    });
    expect(evaluate).toHaveBeenNthCalledWith(1, {
      key: 'client:rotated',
      now: new Date('2026-03-07T00:00:00.000Z'),
    });
    expect(evaluate).toHaveBeenNthCalledWith(2, {
      key: 'anonymous',
      now: new Date('2026-03-07T00:00:00.000Z'),
    });
    expect(verify).not.toHaveBeenCalled();
  });
});
