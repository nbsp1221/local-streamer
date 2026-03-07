import { describe, expect, test, vi } from 'vitest';
import { DestroyAuthSessionUseCase } from './destroy-auth-session.usecase';

describe('DestroyAuthSessionUseCase', () => {
  test('revokes a session when a session id is provided', async () => {
    const revoke = vi.fn();
    const useCase = new DestroyAuthSessionUseCase({
      sessionRepository: {
        revoke,
      },
    });

    await useCase.execute({ sessionId: 'session-1' });

    expect(revoke).toHaveBeenCalledWith('session-1');
  });

  test('is a no-op when no session id is provided', async () => {
    const revoke = vi.fn();
    const useCase = new DestroyAuthSessionUseCase({
      sessionRepository: {
        revoke,
      },
    });

    await useCase.execute({});

    expect(revoke).not.toHaveBeenCalled();
  });
});
