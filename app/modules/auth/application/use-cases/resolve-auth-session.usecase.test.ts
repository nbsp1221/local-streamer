import { describe, expect, test, vi } from 'vitest';
import { SessionPolicy } from '../../domain/policies/SessionPolicy';
import { ResolveAuthSessionUseCase } from './resolve-auth-session.usecase';

describe('ResolveAuthSessionUseCase', () => {
  test('returns null when there is no session id', async () => {
    const useCase = new ResolveAuthSessionUseCase({
      sessionRepository: {
        findById: async () => null,
        touch: async () => {},
      },
      sessionTtlMs: 60_000,
    });

    await expect(useCase.execute({ now: new Date(), sessionId: null })).resolves.toBeNull();
  });

  test('returns null for expired sessions', async () => {
    const session = SessionPolicy.create({
      id: 'session-1',
      now: new Date('2026-03-07T00:00:00.000Z'),
      ttlMs: 1_000,
    });
    const touch = vi.fn();
    const useCase = new ResolveAuthSessionUseCase({
      sessionRepository: {
        findById: async () => session,
        touch,
      },
      sessionTtlMs: 60_000,
    });

    await expect(useCase.execute({
      now: new Date('2026-03-07T00:00:05.000Z'),
      sessionId: 'session-1',
    })).resolves.toBeNull();
    expect(touch).not.toHaveBeenCalled();
  });

  test('returns the active session and touches it', async () => {
    const session = SessionPolicy.create({
      id: 'session-2',
      now: new Date('2026-03-07T00:00:00.000Z'),
      ttlMs: 60_000,
    });
    const touch = vi.fn();
    const useCase = new ResolveAuthSessionUseCase({
      sessionRepository: {
        findById: async () => session,
        touch,
      },
      sessionTtlMs: 60_000,
    });

    const result = await useCase.execute({
      now: new Date('2026-03-07T00:00:10.000Z'),
      sessionId: 'session-2',
    });

    expect(result).toEqual({
      ...session,
      expiresAt: new Date('2026-03-07T00:01:10.000Z'),
      lastAccessedAt: new Date('2026-03-07T00:00:10.000Z'),
    });
    expect(touch).toHaveBeenCalledWith({
      expiresAt: new Date('2026-03-07T00:01:10.000Z'),
      id: 'session-2',
      lastAccessedAt: new Date('2026-03-07T00:00:10.000Z'),
    });
  });
});
