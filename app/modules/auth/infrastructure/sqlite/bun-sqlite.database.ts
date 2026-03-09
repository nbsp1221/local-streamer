import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CreateSqliteDatabase, SqliteDatabaseAdapter } from './sqlite-database.adapter';
import { createInMemoryAuthSessionDatabase } from './in-memory-auth-session.database';

const AUTH_SESSION_SCHEMA = `
  CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    ip_address TEXT,
    is_revoked INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TEXT NOT NULL,
    user_agent TEXT
  )
`;

interface SqliteAdapterSource {
  exec: (sql: string) => unknown;
  prepare?: (sql: string) => {
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => unknown;
  };
  query?: (sql: string) => {
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => unknown;
  };
}

function createSqliteAdapter(
  database: SqliteAdapterSource,
): SqliteDatabaseAdapter {
  return {
    exec(sql) {
      database.exec(sql);
    },
    prepare<Row = unknown>(sql: string) {
      const statementSource = database.query?.(sql) ?? database.prepare?.(sql);

      if (!statementSource) {
        throw new Error('SQLite database does not provide a compatible prepare/query API');
      }

      const statement = statementSource as {
        get: (...params: unknown[]) => Row | undefined;
        run: (...params: unknown[]) => unknown;
      };

      return {
        get: (...params: unknown[]) => statement.get(...params),
        run: (...params: unknown[]) => statement.run(...params),
      };
    },
  };
}

async function createNodeSqliteDatabase(dbPath: string): Promise<SqliteDatabaseAdapter> {
  const { DatabaseSync } = await import('node:sqlite');
  const database = new DatabaseSync(dbPath);

  database.exec('PRAGMA journal_mode = WAL');
  database.exec(AUTH_SESSION_SCHEMA);

  return createSqliteAdapter(database as unknown as SqliteAdapterSource);
}

async function loadBunSqliteDatabase(dbPath: string): Promise<SqliteDatabaseAdapter> {
  const { Database } = await import('bun:sqlite');
  const database = new Database(dbPath, { create: true, strict: true });

  database.exec('PRAGMA journal_mode = WAL');
  database.exec(AUTH_SESSION_SCHEMA);

  return createSqliteAdapter(database as unknown as SqliteAdapterSource);
}

function shouldFallbackToNodeSqlite(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';
  return (
    code === 'ERR_UNSUPPORTED_ESM_URL_SCHEME' ||
    code === 'ERR_MODULE_NOT_FOUND' ||
    error.message.includes('Received protocol \'bun:\'') ||
    error.message.includes('bun:sqlite')
  );
}

function shouldFallbackToInMemorySqlite(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = 'code' in error ? String(error.code) : '';

  return (
    code === 'ERR_UNKNOWN_BUILTIN_MODULE' ||
    code === 'ERR_MODULE_NOT_FOUND' ||
    error.message.includes('node:sqlite')
  );
}

interface CreateSqliteDatabaseForRuntimeInput {
  dbPath: string;
  loadBunDatabase?: (dbPath: string) => Promise<SqliteDatabaseAdapter>;
  loadNodeDatabase?: (dbPath: string) => Promise<SqliteDatabaseAdapter>;
  loadFallbackDatabase?: () => Promise<SqliteDatabaseAdapter> | SqliteDatabaseAdapter;
}

export async function createSqliteDatabaseForRuntime({
  dbPath,
  loadBunDatabase = loadBunSqliteDatabase,
  loadNodeDatabase = createNodeSqliteDatabase,
  loadFallbackDatabase = createInMemoryAuthSessionDatabase,
}: CreateSqliteDatabaseForRuntimeInput): Promise<SqliteDatabaseAdapter> {
  mkdirSync(dirname(dbPath), { recursive: true });

  try {
    return await loadBunDatabase(dbPath);
  }
  catch (error) {
    if (!shouldFallbackToNodeSqlite(error)) {
      throw error;
    }
  }

  try {
    return await loadNodeDatabase(dbPath);
  }
  catch (error) {
    if (!shouldFallbackToInMemorySqlite(error)) {
      throw error;
    }
  }

  return await loadFallbackDatabase();
}

export const createBunSqliteDatabase: CreateSqliteDatabase = async ({ dbPath }) => {
  return createSqliteDatabaseForRuntime({ dbPath });
};
