import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Client, InValue, Transaction } from '@libsql/client';
import { createClient } from '@libsql/client';

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

export interface SqliteRunResult {
  changes: number;
  lastInsertRowid?: bigint;
}

export interface SqliteStatement<RowType = unknown> {
  all: (...params: InValue[]) => Promise<RowType[]>;
  get: (...params: InValue[]) => Promise<RowType | undefined>;
  run: (...params: InValue[]) => Promise<SqliteRunResult>;
}

export interface SqliteDatabaseAdapter {
  exec: (sql: string) => Promise<void>;
  prepare: <RowType = unknown>(sql: string) => SqliteStatement<RowType>;
  transaction: <T>(callback: (database: SqliteDatabaseAdapter) => Promise<T>) => Promise<T>;
}

export interface CreateSqliteDatabaseInput {
  dbPath: string;
}

export type CreateSqliteDatabase = (
  input: CreateSqliteDatabaseInput,
) => Promise<SqliteDatabaseAdapter>;

interface StatementExecutor {
  execute: Client['execute'];
}

function createStatement<RowType>(
  executor: StatementExecutor,
  sql: string,
): SqliteStatement<RowType> {
  return {
    async all(...params) {
      const result = await executor.execute({
        args: params,
        sql,
      });

      return result.rows as RowType[];
    },

    async get(...params) {
      const rows = await this.all(...params);
      return rows[0];
    },

    async run(...params) {
      const result = await executor.execute({
        args: params,
        sql,
      });

      return {
        changes: result.rowsAffected,
        lastInsertRowid: result.lastInsertRowid,
      };
    },
  };
}

function createLibsqlAdapter(client: Client): SqliteDatabaseAdapter {
  return {
    async exec(sql) {
      await client.executeMultiple(sql);
    },

    prepare<RowType = unknown>(sql: string) {
      return createStatement<RowType>(client, sql);
    },

    async transaction<T>(callback: (database: SqliteDatabaseAdapter) => Promise<T>) {
      const transaction = await client.transaction('write');
      const transactionAdapter = createTransactionAdapter(transaction);

      try {
        const result = await callback(transactionAdapter);
        await transaction.commit();
        return result;
      }
      catch (error) {
        await transaction.rollback();
        throw error;
      }
    },
  };
}

function createTransactionAdapter(transaction: Transaction): SqliteDatabaseAdapter {
  return {
    async exec(sql) {
      await transaction.executeMultiple(sql);
    },

    prepare<RowType = unknown>(sql: string) {
      return createStatement<RowType>(transaction, sql);
    },

    async transaction<T>(_callback: (database: SqliteDatabaseAdapter) => Promise<T>) {
      throw new Error('Nested video metadata transactions are not supported');
    },
  };
}

function toFileDatabaseUrl(dbPath: string): string {
  return pathToFileURL(dbPath).href;
}

export const createVideoMetadataSqliteDatabase: CreateSqliteDatabase = async ({ dbPath }) => {
  mkdirSync(dirname(dbPath), { recursive: true });

  const client = createClient({
    url: toFileDatabaseUrl(dbPath),
  });
  const database = createLibsqlAdapter(client);

  await database.exec('PRAGMA journal_mode = WAL');
  await database.exec(LIBRARY_VIDEO_METADATA_SCHEMA);
  await database.exec(LIBRARY_VIDEO_METADATA_STATE_SCHEMA);

  return database;
};
