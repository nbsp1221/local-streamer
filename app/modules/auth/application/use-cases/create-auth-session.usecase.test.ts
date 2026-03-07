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
    const useCase = new CreateAuthSessionUseCase({
      createSessionId: () => 'session-2',
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
  });
});
