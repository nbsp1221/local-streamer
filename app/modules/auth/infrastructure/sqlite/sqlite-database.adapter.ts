export interface SqliteStatement<Row = unknown> {
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
