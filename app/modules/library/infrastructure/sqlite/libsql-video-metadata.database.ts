import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Client, InValue, Transaction } from '@libsql/client';
import { createClient } from '@libsql/client';
import {
  type VideoTaxonomyItem,
  DEFAULT_VIDEO_CONTENT_TYPES,
  DEFAULT_VIDEO_GENRES,
} from '../../domain/video-taxonomy';

const LIBRARY_VIDEO_METADATA_SCHEMA = `
  CREATE TABLE IF NOT EXISTS library_videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    duration INTEGER NOT NULL,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    content_type_slug TEXT,
    genre_slugs_json TEXT NOT NULL DEFAULT '[]',
    tags_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    sort_index INTEGER NOT NULL UNIQUE
  )
`;

const VIDEO_CONTENT_TYPES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS video_content_types (
    slug TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    active INTEGER NOT NULL,
    sort_order INTEGER NOT NULL
  )
`;

const VIDEO_GENRES_SCHEMA = `
  CREATE TABLE IF NOT EXISTS video_genres (
    slug TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    active INTEGER NOT NULL,
    sort_order INTEGER NOT NULL
  )
`;

const VIDEO_METADATA_BOOTSTRAP_STATE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS video_metadata_bootstrap_state (
    key TEXT PRIMARY KEY,
    completed_at TEXT NOT NULL
  )
`;

const VOCABULARY_BOOTSTRAP_KEY = 'initial_video_taxonomy';

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

interface TableColumnRow {
  name: string;
}

interface CountRow {
  count: number;
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
  await database.exec(VIDEO_CONTENT_TYPES_SCHEMA);
  await database.exec(VIDEO_GENRES_SCHEMA);
  await database.exec(VIDEO_METADATA_BOOTSTRAP_STATE_SCHEMA);
  await ensureLibraryVideoMetadataColumns(database);
  await bootstrapInitialVocabulary(database);

  return database;
};

async function ensureLibraryVideoMetadataColumns(database: SqliteDatabaseAdapter) {
  const columns = await database.prepare<TableColumnRow>(`
    PRAGMA table_info(library_videos)
  `).all();
  const existingColumnNames = new Set(columns.map(column => column.name));

  if (!existingColumnNames.has('content_type_slug')) {
    await database.exec(`
      ALTER TABLE library_videos
      ADD COLUMN content_type_slug TEXT
    `);
  }

  if (!existingColumnNames.has('genre_slugs_json')) {
    await database.exec(`
      ALTER TABLE library_videos
      ADD COLUMN genre_slugs_json TEXT NOT NULL DEFAULT '[]'
    `);
  }
}

async function bootstrapInitialVocabulary(database: SqliteDatabaseAdapter) {
  const row = await database.prepare<{ key: string }>(`
    SELECT key
    FROM video_metadata_bootstrap_state
    WHERE key = ?
  `).get(VOCABULARY_BOOTSTRAP_KEY);

  if (row) {
    return;
  }

  await database.transaction(async (transaction) => {
    await bootstrapVocabularyTable(transaction, 'video_content_types', DEFAULT_VIDEO_CONTENT_TYPES);
    await bootstrapVocabularyTable(transaction, 'video_genres', DEFAULT_VIDEO_GENRES);
    await transaction.prepare(`
      INSERT INTO video_metadata_bootstrap_state (key, completed_at)
      VALUES (?, ?)
    `).run(VOCABULARY_BOOTSTRAP_KEY, new Date().toISOString());
  });
}

async function bootstrapVocabularyTable(
  database: SqliteDatabaseAdapter,
  tableName: 'video_content_types' | 'video_genres',
  items: VideoTaxonomyItem[],
) {
  const row = await database.prepare<CountRow>(`
    SELECT COUNT(*) AS count
    FROM ${tableName}
  `).get();

  if ((row?.count ?? 0) > 0) {
    return;
  }

  const insert = database.prepare(`
    INSERT INTO ${tableName} (slug, label, active, sort_order)
    VALUES (?, ?, ?, ?)
  `);

  for (const item of items) {
    await insert.run(
      item.slug,
      item.label,
      item.active ? 1 : 0,
      item.sortOrder,
    );
  }
}
