import { v4 as uuidv4 } from 'uuid';
import type { LibraryVideo } from '../../domain/library-video';
import type { VideoTaxonomyItem } from '../../domain/video-taxonomy';
import type { CreateSqliteDatabase, SqliteDatabaseAdapter } from './libsql-video-metadata.database';
import { createVideoMetadataSqliteDatabase } from './libsql-video-metadata.database';

interface SqliteLibraryVideoMetadataRepositoryOptions {
  createDatabase?: CreateSqliteDatabase;
  dbPath: string;
}

interface LibraryVideoRow {
  content_type_slug: string | null;
  created_at: string;
  description: string | null;
  duration: number;
  genre_slugs_json: string;
  id: string;
  sort_index: number;
  tags_json: string;
  thumbnail_url: string | null;
  title: string;
  video_url: string;
}

interface VideoTaxonomyRow {
  active: number;
  label: string;
  slug: string;
  sort_order: number;
}

export interface CreateLibraryVideoMetadataInput {
  contentTypeSlug?: string;
  createdAt?: Date;
  description?: string;
  duration?: number;
  genreSlugs?: string[];
  id?: string;
  sortIndex?: number;
  tags: string[];
  thumbnailUrl?: string;
  title: string;
  videoUrl: string;
}

export interface UpdateLibraryVideoMetadataInput {
  contentTypeSlug?: string | null;
  description?: string;
  duration?: number;
  genreSlugs?: string[];
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

  async count(): Promise<number> {
    const database = await this.getDatabase();
    const row = await database.prepare<{ count: number }>(`
      SELECT COUNT(*) AS count
      FROM library_videos
    `).get();

    return row?.count ?? 0;
  }

  async create(input: CreateLibraryVideoMetadataInput): Promise<LibraryVideo> {
    const database = await this.getDatabase();
    const createdAt = input.createdAt ?? new Date();
    const id = input.id ?? uuidv4();

    await database.prepare(`
      INSERT INTO library_videos (
        id,
        title,
        description,
        duration,
        video_url,
        thumbnail_url,
        content_type_slug,
        genre_slugs_json,
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
        ?,
        ?,
        COALESCE(?, COALESCE((SELECT MAX(sort_index) FROM library_videos), 0) + 1)
      )
    `).run(
      id,
      input.title,
      input.description ?? null,
      input.duration ?? 0,
      input.videoUrl,
      input.thumbnailUrl ?? null,
      input.contentTypeSlug ?? null,
      JSON.stringify(input.genreSlugs ?? []),
      JSON.stringify(input.tags),
      createdAt.toISOString(),
      input.sortIndex ?? null,
    );

    const created = await this.findById(id);
    if (!created) {
      throw new Error(`Failed to create video metadata for ${id}`);
    }

    return created;
  }

  async delete(id: string): Promise<boolean> {
    const database = await this.getDatabase();
    const result = await database.prepare(`
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
    const rows = await database.prepare<LibraryVideoRow>(`
      SELECT
        id,
        title,
        description,
        duration,
        video_url,
        thumbnail_url,
        content_type_slug,
        genre_slugs_json,
        tags_json,
        created_at,
        sort_index
      FROM library_videos
      ORDER BY sort_index DESC
    `).all();

    return rows.map(row => mapRowToLibraryVideo(row));
  }

  async findById(id: string): Promise<LibraryVideo | null> {
    const database = await this.getDatabase();
    const row = await database.prepare<LibraryVideoRow>(`
      SELECT
        id,
        title,
        description,
        duration,
        video_url,
        thumbnail_url,
        content_type_slug,
        genre_slugs_json,
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
    const nextContentTypeSlug = getNextNullableMetadataValue(
      updates,
      'contentTypeSlug',
      existing.contentTypeSlug,
    );
    const nextGenreSlugs = getNextListMetadataValue(
      updates,
      'genreSlugs',
      existing.genreSlugs ?? [],
    );
    await database.prepare(`
      UPDATE library_videos
      SET
        title = ?,
        description = ?,
        duration = ?,
        video_url = ?,
        thumbnail_url = ?,
        content_type_slug = ?,
        genre_slugs_json = ?,
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
      nextContentTypeSlug,
      JSON.stringify(nextGenreSlugs),
      JSON.stringify(updates.tags ?? existing.tags),
      id,
    );

    return this.findById(id);
  }

  async listActiveContentTypes(): Promise<VideoTaxonomyItem[]> {
    return this.listActiveVocabulary('video_content_types');
  }

  async listActiveGenres(): Promise<VideoTaxonomyItem[]> {
    return this.listActiveVocabulary('video_genres');
  }

  private async listActiveVocabulary(
    tableName: 'video_content_types' | 'video_genres',
  ): Promise<VideoTaxonomyItem[]> {
    const database = await this.getDatabase();
    const rows = await database.prepare<VideoTaxonomyRow>(`
      SELECT slug, label, active, sort_order
      FROM ${tableName}
      WHERE active = 1
      ORDER BY sort_order ASC, label ASC
    `).all();

    return rows.map(row => ({
      active: row.active === 1,
      label: row.label,
      slug: row.slug,
      sortOrder: row.sort_order,
    }));
  }
}

function mapRowToLibraryVideo(row: LibraryVideoRow): LibraryVideo {
  return {
    contentTypeSlug: row.content_type_slug ?? undefined,
    createdAt: new Date(row.created_at),
    description: row.description ?? undefined,
    duration: row.duration,
    genreSlugs: parseJsonStringArray(row.genre_slugs_json),
    id: row.id,
    tags: parseJsonStringArray(row.tags_json),
    thumbnailUrl: row.thumbnail_url ?? undefined,
    title: row.title,
    videoUrl: row.video_url,
  };
}

function getNextNullableMetadataValue<
  TUpdates extends object,
  TKey extends keyof TUpdates,
>(
  updates: TUpdates,
  key: TKey,
  existingValue: string | undefined,
): string | null {
  const nextValue = updates[key];

  if (!Object.hasOwn(updates, key) || typeof nextValue === 'undefined') {
    return existingValue ?? null;
  }

  return (nextValue as string | null) ?? null;
}

function getNextListMetadataValue<
  TUpdates extends object,
  TKey extends keyof TUpdates,
>(
  updates: TUpdates,
  key: TKey,
  existingValue: string[],
): string[] {
  const nextValue = updates[key];

  return Object.hasOwn(updates, key) && Array.isArray(nextValue)
    ? nextValue
    : existingValue;
}

function parseJsonStringArray(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;

  return Array.isArray(parsed)
    ? parsed.filter(item => typeof item === 'string')
    : [];
}
