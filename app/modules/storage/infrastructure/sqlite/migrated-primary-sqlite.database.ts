import { resolve } from 'node:path';
import type { CreatePrimarySqliteDatabaseInput, SqliteDatabaseAdapter } from './primary-sqlite.database';
import { createPrimarySqliteDatabase } from './primary-sqlite.database';
import { runPrimaryStorageMigrations } from './schema-migration-runner';

export type CreateMigratedPrimarySqliteDatabase = (
  input: CreatePrimarySqliteDatabaseInput,
) => Promise<SqliteDatabaseAdapter>;

const migrationPromises = new Map<string, Promise<void>>();

export const createMigratedPrimarySqliteDatabase: CreateMigratedPrimarySqliteDatabase = async (input) => {
  const database = await createPrimarySqliteDatabase(input);
  const migrationKey = resolve(input.dbPath);
  let migrationPromise = migrationPromises.get(migrationKey);
  if (!migrationPromise) {
    migrationPromise = runPrimaryStorageMigrations({ database }).finally(() => {
      migrationPromises.delete(migrationKey);
    });
    migrationPromises.set(migrationKey, migrationPromise);
  }

  await migrationPromise;
  return database;
};
