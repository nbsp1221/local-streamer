import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Client, InValue, Transaction } from '@libsql/client';
import { createClient } from '@libsql/client';

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

export interface CreatePrimarySqliteDatabaseInput {
  dbPath: string;
}

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

function createTransactionAdapter(transaction: Transaction): SqliteDatabaseAdapter {
  return {
    async exec(sql) {
      await transaction.executeMultiple(sql);
    },

    prepare<RowType = unknown>(sql: string) {
      return createStatement<RowType>(transaction, sql);
    },

    async transaction<T>(_callback: (database: SqliteDatabaseAdapter) => Promise<T>) {
      throw new Error('Nested primary storage transactions are not supported');
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

function toFileDatabaseUrl(dbPath: string): string {
  return pathToFileURL(dbPath).href;
}

export async function createPrimarySqliteDatabase(
  input: CreatePrimarySqliteDatabaseInput,
): Promise<SqliteDatabaseAdapter> {
  mkdirSync(dirname(input.dbPath), { recursive: true });

  const client = createClient({
    url: toFileDatabaseUrl(input.dbPath),
  });
  const database = createLibsqlAdapter(client);

  await database.exec('PRAGMA foreign_keys = ON');
  await database.exec('PRAGMA journal_mode = WAL');

  return database;
}
