import type { CreateSqliteDatabase, SqliteDatabaseAdapter } from '~/modules/library/infrastructure/sqlite/libsql-video-metadata.database';
import { createVideoMetadataSqliteDatabase } from '~/modules/library/infrastructure/sqlite/libsql-video-metadata.database';
import type {
  CreateIngestStagedUploadInput,
  IngestStagedUploadRepositoryPort,
  UpdateIngestStagedUploadInput,
} from '../../application/ports/ingest-staged-upload-repository.port';
import type { IngestStagedUpload } from '../../domain/staged-upload';

const INGEST_STAGED_UPLOADS_SCHEMA = `
  CREATE TABLE IF NOT EXISTS ingest_staged_uploads (
    staging_id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    committed_video_id TEXT
  )
`;

interface SqliteIngestStagedUploadRepositoryAdapterDependencies {
  createDatabase?: CreateSqliteDatabase;
  dbPath: string;
}

interface IngestStagedUploadRow {
  committed_video_id: string | null;
  created_at: string;
  expires_at: string;
  filename: string;
  mime_type: string;
  size: number;
  staging_id: string;
  status: IngestStagedUpload['status'];
  storage_path: string;
}

export class SqliteIngestStagedUploadRepositoryAdapter implements IngestStagedUploadRepositoryPort {
  private readonly createDatabase: CreateSqliteDatabase;
  private readonly dbPath: string;
  private databasePromise: Promise<SqliteDatabaseAdapter> | null = null;

  constructor(deps: SqliteIngestStagedUploadRepositoryAdapterDependencies) {
    this.createDatabase = deps.createDatabase ?? createVideoMetadataSqliteDatabase;
    this.dbPath = deps.dbPath;
  }

  async create(upload: CreateIngestStagedUploadInput): Promise<IngestStagedUpload> {
    const database = await this.getDatabase();
    await database.prepare(`
      INSERT INTO ingest_staged_uploads (
        staging_id,
        filename,
        mime_type,
        size,
        storage_path,
        status,
        created_at,
        expires_at,
        committed_video_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      upload.stagingId,
      upload.filename,
      upload.mimeType,
      upload.size,
      upload.storagePath,
      upload.status,
      upload.createdAt.toISOString(),
      upload.expiresAt.toISOString(),
      upload.committedVideoId ?? null,
    );

    const created = await this.findByStagingId(upload.stagingId);
    if (!created) {
      throw new Error(`Failed to create staged upload ${upload.stagingId}`);
    }

    return created;
  }

  async delete(stagingId: string): Promise<void> {
    const database = await this.getDatabase();
    await database.prepare(`
      DELETE FROM ingest_staged_uploads
      WHERE staging_id = ?
    `).run(stagingId);
  }

  async findByStagingId(stagingId: string): Promise<IngestStagedUpload | null> {
    const database = await this.getDatabase();
    const row = await database.prepare<IngestStagedUploadRow>(`
      SELECT
        staging_id,
        filename,
        mime_type,
        size,
        storage_path,
        status,
        created_at,
        expires_at,
        committed_video_id
      FROM ingest_staged_uploads
      WHERE staging_id = ?
    `).get(stagingId);

    return row ? mapRowToStagedUpload(row) : null;
  }

  async listExpired(referenceTime: Date): Promise<IngestStagedUpload[]> {
    const database = await this.getDatabase();
    const rows = await database.prepare<IngestStagedUploadRow>(`
      SELECT
        staging_id,
        filename,
        mime_type,
        size,
        storage_path,
        status,
        created_at,
        expires_at,
        committed_video_id
      FROM ingest_staged_uploads
      WHERE expires_at < ?
        AND status != 'committed'
      ORDER BY created_at ASC
    `).all(referenceTime.toISOString());

    return rows.map(mapRowToStagedUpload);
  }

  async beginCommit(stagingId: string): Promise<'acquired' | 'already_committed' | 'already_committing' | 'missing'> {
    const database = await this.getDatabase();

    return database.transaction(async (transactionDatabase) => {
      const row = await transactionDatabase.prepare<Pick<IngestStagedUploadRow, 'status'>>(`
        SELECT status
        FROM ingest_staged_uploads
        WHERE staging_id = ?
      `).get(stagingId);

      if (!row) {
        return 'missing';
      }

      if (row.status === 'committed') {
        return 'already_committed';
      }

      if (row.status === 'committing') {
        return 'already_committing';
      }

      await transactionDatabase.prepare(`
        UPDATE ingest_staged_uploads
        SET status = 'committing'
        WHERE staging_id = ?
      `).run(stagingId);

      return 'acquired';
    });
  }

  async reserveCommittedVideoId(stagingId: string, nextVideoId: string): Promise<string | null> {
    const database = await this.getDatabase();

    return database.transaction(async (transactionDatabase) => {
      const row = await transactionDatabase.prepare<Pick<IngestStagedUploadRow, 'committed_video_id'>>(`
        SELECT committed_video_id
        FROM ingest_staged_uploads
        WHERE staging_id = ?
      `).get(stagingId);

      if (!row) {
        return null;
      }

      if (row.committed_video_id) {
        return row.committed_video_id;
      }

      await transactionDatabase.prepare(`
        UPDATE ingest_staged_uploads
        SET committed_video_id = ?
        WHERE staging_id = ?
      `).run(nextVideoId, stagingId);

      return nextVideoId;
    });
  }

  async update(stagingId: string, input: UpdateIngestStagedUploadInput): Promise<IngestStagedUpload | null> {
    const database = await this.getDatabase();
    const current = await this.findByStagingId(stagingId);

    if (!current) {
      return null;
    }

    await database.prepare(`
      UPDATE ingest_staged_uploads
      SET
        status = ?,
        expires_at = ?,
        committed_video_id = ?
      WHERE staging_id = ?
    `).run(
      input.status ?? current.status,
      (input.expiresAt ?? current.expiresAt).toISOString(),
      input.committedVideoId ?? current.committedVideoId ?? null,
      stagingId,
    );

    return this.findByStagingId(stagingId);
  }

  private async getDatabase(): Promise<SqliteDatabaseAdapter> {
    if (!this.databasePromise) {
      this.databasePromise = this.createDatabase({
        dbPath: this.dbPath,
      }).then(async (database) => {
        await database.exec(INGEST_STAGED_UPLOADS_SCHEMA);
        return database;
      });
    }

    return this.databasePromise;
  }
}

function mapRowToStagedUpload(row: IngestStagedUploadRow): IngestStagedUpload {
  return {
    committedVideoId: row.committed_video_id ?? undefined,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    filename: row.filename,
    mimeType: row.mime_type,
    size: row.size,
    stagingId: row.staging_id,
    status: row.status,
    storagePath: row.storage_path,
  };
}
