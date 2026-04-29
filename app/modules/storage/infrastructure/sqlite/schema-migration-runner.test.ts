import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { createMigratedPrimarySqliteDatabase } from './migrated-primary-sqlite.database';
import { createPrimarySqliteDatabase } from './primary-sqlite.database';
import { primaryStorageMigrationSql } from './primary-storage-migration.sql';
import { runPrimaryStorageMigrations } from './schema-migration-runner';

interface CountRow {
  count: number;
}

interface MigrationRow {
  name: string;
  version: number;
}

interface NameRow {
  name: string;
}

const workspaces: string[] = [];
const currentDir = path.dirname(fileURLToPath(import.meta.url));

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { force: true, recursive: true });
  }
});

async function createMigratedDatabase() {
  const workspace = mkdtempSync(path.join(tmpdir(), 'local-streamer-storage-schema-'));
  workspaces.push(workspace);

  const dbPath = path.join(workspace, 'storage', 'db.sqlite');
  const database = await createPrimarySqliteDatabase({ dbPath });
  await runPrimaryStorageMigrations({ database });

  return {
    database,
    dbPath,
  };
}

async function countRows(database: Awaited<ReturnType<typeof createPrimarySqliteDatabase>>, tableName: string) {
  const row = await database.prepare<CountRow>(`SELECT COUNT(*) AS count FROM ${tableName}`).get();
  return row?.count ?? 0;
}

describe('primary storage schema migrations', () => {
  test('keeps the bundled migration SQL in sync with the checked-in SQL file', () => {
    const sqlPath = path.join(currentDir, 'migrations', '0001_primary_storage.sql');

    expect(primaryStorageMigrationSql.trim()).toBe(readFileSync(sqlPath, 'utf8').trim());
  });

  test('creates the primary schema and records applied migrations exactly once', async () => {
    const { database } = await createMigratedDatabase();

    const tables = await database.prepare<NameRow>(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
      ORDER BY name
    `).all();

    expect(tables.map(table => table.name)).toEqual(expect.arrayContaining([
      'auth_sessions',
      'ingest_uploads',
      'playlist_items',
      'playlists',
      'schema_migrations',
      'tags',
      'video_content_types',
      'video_genre_assignments',
      'video_genres',
      'video_media_assets',
      'video_tags',
      'videos',
    ]));
    expect(await database.prepare<MigrationRow>(`
      SELECT version, name
      FROM schema_migrations
      ORDER BY version
    `).all()).toEqual([
      {
        name: 'primary_storage',
        version: 1,
      },
    ]);
    expect(await countRows(database, 'video_content_types')).toBeGreaterThan(0);
    expect(await countRows(database, 'video_genres')).toBeGreaterThan(0);
  });

  test('is idempotent when migrations run more than once', async () => {
    const { database } = await createMigratedDatabase();
    const contentTypeCount = await countRows(database, 'video_content_types');
    const genreCount = await countRows(database, 'video_genres');

    await runPrimaryStorageMigrations({ database });

    expect(await countRows(database, 'schema_migrations')).toBe(1);
    expect(await countRows(database, 'video_content_types')).toBe(contentTypeCount);
    expect(await countRows(database, 'video_genres')).toBe(genreCount);
  });

  test('serializes concurrent cold-start migrations for one primary database file', async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), 'local-streamer-storage-schema-'));
    workspaces.push(workspace);
    const dbPath = path.join(workspace, 'storage', 'db.sqlite');

    const databases = await Promise.all(
      Array.from({ length: 8 }, () => createMigratedPrimarySqliteDatabase({ dbPath })),
    );

    expect(await countRows(databases[0], 'schema_migrations')).toBe(1);
    expect(await countRows(databases[0], 'video_content_types')).toBeGreaterThan(0);
    await expect(databases[0].prepare<NameRow>(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name = 'videos'
    `).get()).resolves.toMatchObject({ name: 'videos' });
  });

  test('rolls back partial schema work and does not record failed migrations', async () => {
    const { database } = await createMigratedDatabase();

    await expect(runPrimaryStorageMigrations({
      database,
      migrations: [
        {
          name: 'broken_migration',
          sql: `
            CREATE TABLE partial_failure_table (
              id TEXT PRIMARY KEY
            ) STRICT;
            SELECT *
            FROM table_that_does_not_exist;
          `,
          version: 2,
        },
      ],
    })).rejects.toThrow();

    expect(await database.prepare<NameRow>(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'partial_failure_table'
    `).get()).toBeUndefined();
    expect(await database.prepare<MigrationRow>(`
      SELECT version, name
      FROM schema_migrations
      WHERE version = 2
    `).get()).toBeUndefined();
  });

  test('does not mark an incompatible pre-existing schema as migrated', async () => {
    const workspace = mkdtempSync(path.join(tmpdir(), 'local-streamer-storage-drift-'));
    workspaces.push(workspace);
    const dbPath = path.join(workspace, 'storage', 'db.sqlite');
    const database = await createPrimarySqliteDatabase({ dbPath });

    await database.exec(`
      CREATE TABLE videos (
        id TEXT PRIMARY KEY
      ) STRICT
    `);

    await expect(runPrimaryStorageMigrations({ database })).rejects.toThrow();
    expect(await database.prepare<MigrationRow>(`
      SELECT version, name
      FROM schema_migrations
      WHERE version = 1
    `).get()).toBeUndefined();
  });

  test('enforces foreign keys on newly opened primary database connections', async () => {
    const { dbPath } = await createMigratedDatabase();
    const reopenedDatabase = await createPrimarySqliteDatabase({ dbPath });

    await expect(reopenedDatabase.prepare(`
      INSERT INTO video_tags (video_id, tag_slug)
      VALUES (?, ?)
    `).run('missing-video', 'missing-tag')).rejects.toThrow();
  });

  test('enforces core relational constraints for videos, media assets, playlists, and auth', async () => {
    const { database } = await createMigratedDatabase();
    const now = '2026-04-28T00:00:00.000Z';

    await database.prepare(`
      INSERT INTO videos (id, title, duration_seconds, created_at, updated_at, sort_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('video-1', 'Video 1', 10.5, now, now, 1);
    await database.prepare(`
      INSERT INTO videos (id, title, duration_seconds, created_at, updated_at, sort_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('video-2', 'Video 2', 20.5, now, now, 2);
    await database.prepare(`
      INSERT INTO videos (id, title, duration_seconds, created_at, updated_at, sort_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('video-3', 'Video 3', 30.5, now, now, 3);
    await expect(database.prepare(`
      INSERT INTO videos (id, title, duration_seconds, created_at, updated_at, sort_index)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('..', 'Unsafe Video', 10.5, now, now, 4)).rejects.toThrow();
    await expect(database.prepare(`
      INSERT INTO video_content_types (slug, label, active, sort_order)
      VALUES (?, ?, ?, ?)
    `).run('../bad-content-type', 'Bad Content Type', 0, 999)).rejects.toThrow();
    await expect(database.prepare(`
      INSERT INTO video_genres (slug, label, active, sort_order)
      VALUES (?, ?, ?, ?)
    `).run('../bad-genre', 'Bad Genre', 0, 999)).rejects.toThrow();
    await database.prepare(`
      INSERT INTO tags (slug, label, created_at)
      VALUES (?, ?, ?)
    `).run('tag-one', 'Tag One', now);
    await database.prepare(`
      INSERT INTO playlists (id, owner_id, name, name_key, type, is_public, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('playlist-1', 'owner-1', 'Favorites', 'favorites', 'manual', 0, now, now);
    await expect(database.prepare(`
      INSERT INTO playlists (id, owner_id, name, name_key, type, is_public, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('playlist-2', 'owner-1', 'FAVORITES', 'favorites', 'manual', 0, now, now)).rejects.toThrow();
    await database.prepare(`
      INSERT INTO playlists (id, owner_id, name, name_key, type, is_public, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('playlist-2', 'owner-2', 'Favorites', 'favorites', 'manual', 0, now, now);

    await database.prepare(`
      INSERT INTO video_tags (video_id, tag_slug)
      VALUES (?, ?)
    `).run('video-1', 'tag-one');
    await expect(database.prepare(`
      INSERT INTO video_tags (video_id, tag_slug)
      VALUES (?, ?)
    `).run('video-1', 'tag-one')).rejects.toThrow();

    await database.prepare(`
      INSERT INTO playlist_items (playlist_id, video_id, position, added_at, added_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('playlist-1', 'video-1', 0, now, 'owner-1');
    await expect(database.prepare(`
      INSERT INTO playlist_items (playlist_id, video_id, position, added_at, added_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('playlist-1', 'video-1', 1, now, 'owner-1')).rejects.toThrow();
    await expect(database.prepare(`
      INSERT INTO playlist_items (playlist_id, video_id, position, added_at, added_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('playlist-1', 'video-2', 0, now, 'owner-1')).rejects.toThrow();
    await expect(database.prepare(`
      INSERT INTO playlist_items (playlist_id, video_id, position, added_at, added_by)
      VALUES (?, ?, ?, ?, ?)
    `).run('playlist-1', 'video-2', -1, now, 'owner-1')).rejects.toThrow();

    await expect(database.prepare(`
      INSERT INTO playlists (id, owner_id, name, name_key, type, is_public, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('playlist-3', 'owner-1', 'Bad Boolean', 'bad-boolean', 'manual', 2, now, now)).rejects.toThrow();
    await expect(database.prepare(`
      INSERT INTO auth_sessions (id, created_at, expires_at, is_revoked, last_accessed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run('session-1', now, now, 2, now)).rejects.toThrow();

    await expect(database.prepare(`
      INSERT INTO video_media_assets (
        video_id,
        layout_version,
        status,
        preparation_strategy
      )
      VALUES (?, ?, ?, ?)
    `).run('video-1', 1, 'ready', 'copy')).rejects.toThrow();
    await expect(database.prepare(`
      INSERT INTO video_media_assets (
        video_id,
        layout_version,
        status,
        preparation_strategy
      )
      VALUES (?, ?, ?, ?)
    `).run('video-1', 1, 'failed', 'copy')).rejects.toThrow();
    await expect(database.prepare(`
      INSERT INTO video_media_assets (
        video_id,
        layout_version,
        status,
        preparation_strategy
      )
      VALUES (?, ?, ?, ?)
    `).run('video-1', 1, 'unknown', 'copy')).rejects.toThrow();
    await database.prepare(`
      INSERT INTO video_media_assets (
        video_id,
        layout_version,
        status,
        preparation_strategy
      )
      VALUES (?, ?, ?, ?)
    `).run('video-1', 1, 'preparing', 'copy');

    await database.prepare(`
      INSERT INTO ingest_uploads (
        staging_id,
        filename,
        mime_type,
        size_bytes,
        storage_relpath,
        status,
        created_at,
        updated_at,
        expires_at,
        reserved_video_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('staging-1', 'video.mp4', 'video/mp4', 10, 'staging/staging-1/source', 'uploaded', now, now, now, 'future-video-id');
    await database.prepare(`
      INSERT INTO ingest_uploads (
        staging_id,
        filename,
        mime_type,
        size_bytes,
        storage_relpath,
        status,
        created_at,
        updated_at,
        expires_at,
        committed_video_id,
        committed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('staging-2', 'video.mp4', 'video/mp4', 10, 'staging/staging-2/source', 'committed', now, now, now, 'video-3', now);
    await expect(database.prepare(`
      DELETE FROM videos
      WHERE id = ?
    `).run('video-3')).rejects.toThrow();
    await expect(database.prepare(`
      INSERT INTO ingest_uploads (
        staging_id,
        filename,
        mime_type,
        size_bytes,
        storage_relpath,
        status,
        created_at,
        updated_at,
        expires_at,
        committed_video_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('staging-3', 'video.mp4', 'video/mp4', 10, 'staging/staging-3/source', 'committed', now, now, now, 'missing-video')).rejects.toThrow();
    await expect(database.prepare(`
      INSERT INTO ingest_uploads (
        staging_id,
        filename,
        mime_type,
        size_bytes,
        storage_relpath,
        status,
        created_at,
        updated_at,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('staging-4', 'video.mp4', 'video/mp4', 10, 'staging/staging-4/source', 'unknown', now, now, now)).rejects.toThrow();
    await expect(database.prepare(`
      INSERT INTO ingest_uploads (
        staging_id,
        filename,
        mime_type,
        size_bytes,
        storage_relpath,
        status,
        created_at,
        updated_at,
        expires_at,
        committed_video_id,
        committed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('staging-5', 'video.mp4', 'video/mp4', 10, 'staging/staging-5/source', 'uploaded', now, now, now, 'video-1', now)).rejects.toThrow();
  });

  test('enforces media asset readiness contracts with positive and negative cases', async () => {
    const { database } = await createMigratedDatabase();
    const now = '2026-04-28T00:00:00.000Z';

    for (const [id, sortIndex] of [['ready-video', 1], ['failed-video', 2], ['preparing-video', 3]] as const) {
      await database.prepare(`
        INSERT INTO videos (id, title, duration_seconds, created_at, updated_at, sort_index)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id, id, 10.5, now, now, sortIndex);
    }

    await database.prepare(`
      INSERT INTO video_media_assets (
        video_id,
        layout_version,
        status,
        preparation_strategy,
        manifest_relpath,
        key_relpath,
        thumbnail_relpath,
        video_init_relpath,
        video_segment_glob,
        audio_init_relpath,
        audio_segment_glob,
        prepared_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'ready-video',
      1,
      'ready',
      'copy',
      'manifest.mpd',
      'key.bin',
      'thumbnail.jpg',
      'video/init.mp4',
      'video/segment-*.m4s',
      'audio/init.mp4',
      'audio/segment-*.m4s',
      now,
    );
    await expect(database.prepare(`
      INSERT INTO video_media_assets (
        video_id,
        layout_version,
        status,
        preparation_strategy,
        manifest_relpath,
        key_relpath,
        thumbnail_relpath,
        video_init_relpath,
        video_segment_glob,
        audio_init_relpath,
        audio_segment_glob,
        prepared_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'failed-video',
      1,
      'ready',
      'copy',
      '',
      'key.bin',
      'thumbnail.jpg',
      'video/init.mp4',
      'video/segment-*.m4s',
      'audio/init.mp4',
      'audio/segment-*.m4s',
      now,
    )).rejects.toThrow();

    await database.prepare(`
      INSERT INTO video_media_assets (
        video_id,
        layout_version,
        status,
        preparation_strategy,
        failed_at,
        failure_message
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `).run('failed-video', 1, 'failed', 'copy', now, 'probe failed');
    await database.prepare(`
      INSERT INTO video_media_assets (
        video_id,
        layout_version,
        status,
        preparation_strategy
      )
      VALUES (?, ?, ?, ?)
    `).run('preparing-video', 1, 'preparing', 'copy');
  });
});
