import { v4 as uuidv4 } from 'uuid';
import type { LibraryVideo } from '../../domain/library-video';
import type { CreateSqliteDatabase, SqliteDatabaseAdapter } from './video-metadata-sqlite.database';
import { createVideoMetadataSqliteDatabase } from './video-metadata-sqlite.database';

interface SqliteLibraryVideoMetadataRepositoryOptions {
  createDatabase?: CreateSqliteDatabase;
  dbPath: string;
}

interface LibraryVideoRow {
  created_at: string;
  description: string | null;
  duration: number;
  id: string;
  sort_index: number;
  tags_json: string;
  thumbnail_url: string | null;
  title: string;
  video_url: string;
}

export interface CreateLibraryVideoMetadataInput {
  createdAt?: Date;
  description?: string;
  duration?: number;
  id?: string;
  sortIndex?: number;
  tags: string[];
  thumbnailUrl?: string;
  title: string;
  videoUrl: string;
}

export interface UpdateLibraryVideoMetadataInput {
  description?: string;
  duration?: number;
  tags?: string[];
  thumbnailUrl?: string;
  title?: string;
  videoUrl?: string;
}

export class SqliteLibraryVideoMetadataRepository {
  private readonly createDatabase: CreateSqliteDatabase;
  private readonly dbPath: string;
  private databasePromise: Promise<SqliteDatabaseAdapter> | null = null;

  constructor(options: SqliteLibraryVideoMetadataRepositoryOptions) {
    this.createDatabase = options.createDatabase ?? createVideoMetadataSqliteDatabase;
    this.dbPath = options.dbPath;
  }

  private async getDatabase(): Promise<SqliteDatabaseAdapter> {
    if (!this.databasePromise) {
      this.databasePromise = this.createDatabase({
        dbPath: this.dbPath,
      });
    }

    return this.databasePromise;
  }

  async bootstrapFromVideos(videos: LibraryVideo[]): Promise<void> {
    const database = await this.getDatabase();
    let sortIndex = videos.length;

    database.exec('BEGIN IMMEDIATE');

    try {
      for (const video of videos) {
        database.prepare(`
          INSERT OR IGNORE INTO library_videos (
            id,
            title,
            description,
            duration,
            video_url,
            thumbnail_url,
            tags_json,
            created_at,
            sort_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          video.id,
          video.title,
          video.description ?? null,
          video.duration,
          video.videoUrl,
          video.thumbnailUrl ?? null,
          JSON.stringify(video.tags),
          video.createdAt.toISOString(),
          sortIndex,
        );
        sortIndex -= 1;
      }

      database.prepare(`
        INSERT OR REPLACE INTO library_video_metadata_state (
          key,
          value
        ) VALUES (?, ?)
      `).run('legacy_bootstrap_complete', 'true');
      database.exec('COMMIT');
    }
    catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  async count(): Promise<number> {
    const database = await this.getDatabase();
    const row = database.prepare<{ count: number }>(`
      SELECT COUNT(*) AS count
      FROM library_videos
    `).get();

    return row?.count ?? 0;
  }

  async create(input: CreateLibraryVideoMetadataInput): Promise<LibraryVideo> {
    const database = await this.getDatabase();
    const createdAt = input.createdAt ?? new Date();
    const sortIndex = input.sortIndex;
    const id = input.id ?? uuidv4();

    if (typeof sortIndex === 'number') {
      database.prepare(`
        INSERT INTO library_videos (
          id,
          title,
          description,
          duration,
          video_url,
          thumbnail_url,
          tags_json,
          created_at,
          sort_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.title,
        input.description ?? null,
        input.duration ?? 0,
        input.videoUrl,
        input.thumbnailUrl ?? null,
        JSON.stringify(input.tags),
        createdAt.toISOString(),
        sortIndex,
      );
    }
    else {
      database.prepare(`
        INSERT INTO library_videos (
          id,
          title,
          description,
          duration,
          video_url,
          thumbnail_url,
          tags_json,
          created_at,
          sort_index
        ) VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          COALESCE((SELECT MAX(sort_index) FROM library_videos), 0) + 1
        )
      `).run(
        id,
        input.title,
        input.description ?? null,
        input.duration ?? 0,
        input.videoUrl,
        input.thumbnailUrl ?? null,
        JSON.stringify(input.tags),
        createdAt.toISOString(),
      );
    }

    const created = await this.findById(id);
    if (!created) {
      throw new Error(`Failed to create video metadata for ${id}`);
    }

    return created;
  }

  async delete(id: string): Promise<boolean> {
    const database = await this.getDatabase();
    const result = database.prepare(`
      DELETE FROM library_videos
      WHERE id = ?
    `).run(id) as { changes?: number };

    return (result.changes ?? 0) > 0;
  }

  async exists(id: string): Promise<boolean> {
    return (await this.findById(id)) !== null;
  }

  async findAll(): Promise<LibraryVideo[]> {
    const database = await this.getDatabase();
    const rows = database.prepare<LibraryVideoRow>(`
      SELECT
        id,
        title,
        description,
        duration,
        video_url,
        thumbnail_url,
        tags_json,
        created_at,
        sort_index
      FROM library_videos
      ORDER BY sort_index DESC
    `).all?.() ?? [];

    return rows.map(row => mapRowToLibraryVideo(row));
  }

  async findById(id: string): Promise<LibraryVideo | null> {
    const database = await this.getDatabase();
    const row = database.prepare<LibraryVideoRow>(`
      SELECT
        id,
        title,
        description,
        duration,
        video_url,
        thumbnail_url,
        tags_json,
        created_at,
        sort_index
      FROM library_videos
      WHERE id = ?
    `).get(id);

    return row ? mapRowToLibraryVideo(row) : null;
  }

  async findByTag(tag: string): Promise<LibraryVideo[]> {
    const normalizedTag = tag.toLowerCase();
    const videos = await this.findAll();

    return videos.filter(video => video.tags.some(
      videoTag => videoTag.toLowerCase() === normalizedTag,
    ));
  }

  async findByTitle(title: string): Promise<LibraryVideo[]> {
    const normalizedTitle = title.toLowerCase();
    const videos = await this.findAll();

    return videos.filter(video => video.title.toLowerCase().includes(normalizedTitle));
  }

  async getAllTags(): Promise<string[]> {
    const videos = await this.findAll();
    const tagSet = new Set<string>();

    for (const video of videos) {
      for (const tag of video.tags) {
        tagSet.add(tag);
      }
    }

    return Array.from(tagSet).sort();
  }

  async search(query: string): Promise<LibraryVideo[]> {
    const normalizedQuery = query.toLowerCase();
    const videos = await this.findAll();

    return videos.filter(video => (
      video.title.toLowerCase().includes(normalizedQuery) ||
      video.tags.some(tag => tag.toLowerCase().includes(normalizedQuery))
    ));
  }

  async update(
    id: string,
    updates: UpdateLibraryVideoMetadataInput,
  ): Promise<LibraryVideo | null> {
    const existing = await this.findById(id);

    if (!existing) {
      return null;
    }

    const database = await this.getDatabase();
    database.prepare(`
      UPDATE library_videos
      SET
        title = ?,
        description = ?,
        duration = ?,
        video_url = ?,
        thumbnail_url = ?,
        tags_json = ?
      WHERE id = ?
    `).run(
      updates.title ?? existing.title,
      typeof updates.description === 'undefined'
        ? existing.description ?? null
        : updates.description ?? null,
      updates.duration ?? existing.duration,
      updates.videoUrl ?? existing.videoUrl,
      typeof updates.thumbnailUrl === 'undefined'
        ? existing.thumbnailUrl ?? null
        : updates.thumbnailUrl ?? null,
      JSON.stringify(updates.tags ?? existing.tags),
      id,
    );

    return this.findById(id);
  }

  async isBootstrapComplete(): Promise<boolean> {
    const database = await this.getDatabase();
    const row = database.prepare<{ value: string }>(`
      SELECT value
      FROM library_video_metadata_state
      WHERE key = ?
    `).get('legacy_bootstrap_complete');

    return row?.value === 'true';
  }
}

function mapRowToLibraryVideo(row: LibraryVideoRow): LibraryVideo {
  return {
    createdAt: new Date(row.created_at),
    description: row.description ?? undefined,
    duration: row.duration,
    id: row.id,
    tags: JSON.parse(row.tags_json) as string[],
    thumbnailUrl: row.thumbnail_url ?? undefined,
    title: row.title,
    videoUrl: row.video_url,
  };
}
