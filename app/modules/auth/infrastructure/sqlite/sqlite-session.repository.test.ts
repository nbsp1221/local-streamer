import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SessionPolicy } from '../../domain/policies/SessionPolicy';
import { SqliteSessionRepository } from './sqlite-session.repository';

interface AuthSessionRow {
  created_at: string;
  expires_at: string;
  id: string;
  ip_address: string | null;
  is_revoked: number;
  last_accessed_at: string;
  user_agent: string | null;
}

class InMemorySqliteDatabase {
  private readonly rows = new Map<string, AuthSessionRow>();

  exec(_sql: string) {}

  prepare<T>(sql: string) {
    if (sql.includes('SELECT') && sql.includes('FROM auth_sessions')) {
      return {
        get: (...params: unknown[]) => this.rows.get(String(params[0])) as T | undefined,
        run: () => {
          throw new Error('run() is not supported for SELECT statements in this test adapter');
        },
      };
    }

    if (sql.includes('INSERT OR REPLACE INTO auth_sessions')) {
      return {
        get: () => {
          throw new Error('get() is not supported for INSERT statements in this test adapter');
        },
        run: (...params: unknown[]) => {
          const [
            id,
            createdAt,
            expiresAt,
            ipAddress,
            isRevoked,
            lastAccessedAt,
            userAgent,
          ] = params as [string, string, string, string | null, number, string, string | null];
          this.rows.set(id, {
            created_at: createdAt,
            expires_at: expiresAt,
            id,
            ip_address: ipAddress,
            is_revoked: isRevoked,
            last_accessed_at: lastAccessedAt,
            user_agent: userAgent,
          });
          return { changes: 1 };
        },
      };
    }

    if (sql.includes('SET is_revoked = 1')) {
      return {
        get: () => {
          throw new Error('get() is not supported for UPDATE statements in this test adapter');
        },
        run: (...params: unknown[]) => {
          const [id] = params as [string];
          const row = this.rows.get(id);
          if (row) {
            this.rows.set(id, {
              ...row,
              is_revoked: 1,
            });
          }

          return { changes: row ? 1 : 0 };
        },
      };
    }

    if (sql.includes('SET') && sql.includes('expires_at = ?') && sql.includes('last_accessed_at = ?')) {
      return {
        get: () => {
          throw new Error('get() is not supported for UPDATE statements in this test adapter');
        },
        run: (...params: unknown[]) => {
          const [expiresAt, lastAccessedAt, id] = params as [string, string, string];
          const row = this.rows.get(id);
          if (row) {
            this.rows.set(id, {
              ...row,
              expires_at: expiresAt,
              last_accessed_at: lastAccessedAt,
            });
          }

          return { changes: row ? 1 : 0 };
        },
      };
    }

    throw new Error(`Unsupported SQL in test adapter: ${sql}`);
  }
}

describe('SqliteSessionRepository', () => {
  let dbPath: string;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-auth-'));
    dbPath = join(tempDir, 'auth.sqlite');
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  test('creates and finds an active session', async () => {
    const repository = new SqliteSessionRepository({
      createDatabase: async () => new InMemorySqliteDatabase(),
      dbPath,
    });
    const session = SessionPolicy.create({
      id: 'session-1',
      now: new Date('2026-03-07T00:00:00.000Z'),
      ttlMs: 60_000,
      userAgent: 'vitest',
    });

    await repository.save(session);

    const found = await repository.findById('session-1');

    expect(found).toEqual(session);
  });

  test('returns null for an unknown session', async () => {
    const repository = new SqliteSessionRepository({
      createDatabase: async () => new InMemorySqliteDatabase(),
      dbPath,
    });

    await expect(repository.findById('missing')).resolves.toBeNull();
  });

  test('revokes a session', async () => {
    const repository = new SqliteSessionRepository({
      createDatabase: async () => new InMemorySqliteDatabase(),
      dbPath,
    });
    const session = SessionPolicy.create({
      id: 'session-2',
      now: new Date('2026-03-07T00:00:00.000Z'),
      ttlMs: 60_000,
    });

    await repository.save(session);
    await repository.revoke('session-2');

    const found = await repository.findById('session-2');

    expect(found).toEqual({
      ...session,
      isRevoked: true,
    });
  });

  test('touch updates last accessed and expiry', async () => {
    const repository = new SqliteSessionRepository({
      createDatabase: async () => new InMemorySqliteDatabase(),
      dbPath,
    });
    const session = SessionPolicy.create({
      id: 'session-3',
      now: new Date('2026-03-07T00:00:00.000Z'),
      ttlMs: 60_000,
    });

    await repository.save(session);
    await repository.touch({
      expiresAt: new Date('2026-03-07T00:02:00.000Z'),
      id: 'session-3',
      lastAccessedAt: new Date('2026-03-07T00:01:00.000Z'),
    });

    const found = await repository.findById('session-3');

    expect(found).toEqual({
      ...session,
      expiresAt: new Date('2026-03-07T00:02:00.000Z'),
      lastAccessedAt: new Date('2026-03-07T00:01:00.000Z'),
    });
  });

  test('creates the Bun database lazily on first repository use', async () => {
    const createDatabase = vi.fn(async () => new InMemorySqliteDatabase());
    const repository = new SqliteSessionRepository({
      createDatabase,
      dbPath,
    });

    expect(createDatabase).not.toHaveBeenCalled();

    await repository.findById('missing');

    expect(createDatabase).toHaveBeenCalledTimes(1);
  });
});
