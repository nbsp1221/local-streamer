import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const LIBRARY_VIDEO_METADATA_SCHEMA = `
  CREATE TABLE IF NOT EXISTS library_videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    tags_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    sort_index INTEGER NOT NULL UNIQUE
  )
`;

const LIBRARY_VIDEO_METADATA_STATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS library_video_metadata_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`;

interface SqliteAdapterSource {
  exec: (sql: string) => unknown;
  prepare?: (sql: string) => {
    all?: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => unknown;
  };
  query?: (sql: string) => {
    all?: (...params: unknown[]) => unknown[];
    get: (...params: unknown[]) => unknown;
    run: (...params: unknown[]) => unknown;
  };
}

export interface SqliteStatement<Row = unknown> {
  all?: (...params: unknown[]) => Row[];
  get: (...params: unknown[]) => Row | undefined;
  run: (...params: unknown[]) => unknown;
}

export interface SqliteDatabaseAdapter {
  exec: (sql: string) => void;
  prepare: <Row = unknown>(sql: string) => SqliteStatement<Row>;
}

export interface CreateSqliteDatabaseInput {
  dbPath: string;
}

export type CreateSqliteDatabase = (input: CreateSqliteDatabaseInput) => Promise<SqliteDatabaseAdapter>;

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
        all?: (...params: unknown[]) => Row[];
        get: (...params: unknown[]) => Row | undefined;
        run: (...params: unknown[]) => unknown;
      };

      return {
        all: statement.all ? (...params: unknown[]) => statement.all!(...params) : undefined,
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
  database.exec(LIBRARY_VIDEO_METADATA_SCHEMA);
  database.exec(LIBRARY_VIDEO_METADATA_STATE_SCHEMA);

  return createSqliteAdapter(database as unknown as SqliteAdapterSource);
}

async function loadBunSqliteDatabase(dbPath: string): Promise<SqliteDatabaseAdapter> {
  const { Database } = await import('bun:sqlite');
  const database = new Database(dbPath, { create: true, strict: true });

  database.exec('PRAGMA journal_mode = WAL');
  database.exec(LIBRARY_VIDEO_METADATA_SCHEMA);
  database.exec(LIBRARY_VIDEO_METADATA_STATE_SCHEMA);

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

export async function createSqliteDatabaseForRuntime({
  dbPath,
  loadBunDatabase = loadBunSqliteDatabase,
  loadNodeDatabase = createNodeSqliteDatabase,
}: CreateSqliteDatabaseInput & {
  loadBunDatabase?: (dbPath: string) => Promise<SqliteDatabaseAdapter>;
  loadNodeDatabase?: (dbPath: string) => Promise<SqliteDatabaseAdapter>;
}): Promise<SqliteDatabaseAdapter> {
  mkdirSync(dirname(dbPath), { recursive: true });

  try {
    return await loadBunDatabase(dbPath);
  }
  catch (error) {
    if (!shouldFallbackToNodeSqlite(error)) {
      throw error;
    }
  }

  return loadNodeDatabase(dbPath);
}

export const createVideoMetadataSqliteDatabase: CreateSqliteDatabase = async ({ dbPath }) => {
  return createSqliteDatabaseForRuntime({ dbPath });
};
