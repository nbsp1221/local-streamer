import type { CreatePrimarySqliteDatabaseInput, SqliteDatabaseAdapter } from './primary-sqlite.database';
import { createPrimarySqliteDatabase } from './primary-sqlite.database';
import { runPrimaryStorageMigrations } from './schema-migration-runner';

export type CreateMigratedPrimarySqliteDatabase = (
  input: CreatePrimarySqliteDatabaseInput,
) => Promise<SqliteDatabaseAdapter>;

const migrationPromises = new Map<string, Promise<void>>();

export const createMigratedPrimarySqliteDatabase: CreateMigratedPrimarySqliteDatabase = async (input) => {
  const database = await createPrimarySqliteDatabase(input);
  let migrationPromise = migrationPromises.get(input.dbPath);
  if (!migrationPromise) {
    migrationPromise = runPrimaryStorageMigrations({ database }).finally(() => {
      migrationPromises.delete(input.dbPath);
    });
    migrationPromises.set(input.dbPath, migrationPromise);
  }

  await migrationPromise;
  return database;
};
