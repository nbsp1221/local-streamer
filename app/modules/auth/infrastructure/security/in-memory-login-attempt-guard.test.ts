import { afterEach, describe, expect, test, vi } from 'vitest';
import { InMemoryLoginAttemptGuard } from './in-memory-login-attempt-guard';

describe('InMemoryLoginAttemptGuard', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('sweeps expired records while evaluating a different key', () => {
    const guard = new InMemoryLoginAttemptGuard({
      blockDurationMs: 100,
      maxFailures: 5,
      windowMs: 100,
    });
    const guardState = guard as unknown as {
      records: Map<string, unknown>;
    };

    guard.registerFailure({
      key: 'stale',
      now: new Date('2026-03-08T00:00:00.000Z'),
    });

    expect(guardState.records.has('stale')).toBe(true);

    guard.evaluate({
      key: 'fresh',
      now: new Date('2026-03-08T00:00:01.000Z'),
    });

    expect(guardState.records.has('stale')).toBe(false);
  });

  test('evicts idle mutexes after they are no longer protecting live state', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-08T00:00:00.000Z'));

    const guard = new InMemoryLoginAttemptGuard({
      blockDurationMs: 100,
      maxFailures: 5,
      windowMs: 100,
    });
    const guardState = guard as unknown as {
      mutexes: Map<string, unknown>;
    };

    await guard.runExclusive('stale', async () => {});

    expect(guardState.mutexes.has('stale')).toBe(true);

    vi.setSystemTime(new Date('2026-03-08T00:00:01.000Z'));
    guard.evaluate({
      key: 'fresh',
      now: new Date(),
    });

    expect(guardState.mutexes.has('stale')).toBe(false);
  });
});
