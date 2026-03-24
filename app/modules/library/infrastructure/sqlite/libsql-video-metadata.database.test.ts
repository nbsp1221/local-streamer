import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createVideoMetadataSqliteDatabase } from './libsql-video-metadata.database';

describe('createVideoMetadataSqliteDatabase', () => {
  let dbPath: string;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-libsql-video-metadata-'));
    dbPath = join(tempDir, 'video-metadata.sqlite');
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  test('persists rows across reopened adapters instead of falling back to memory', async () => {
    const firstDatabase = await createVideoMetadataSqliteDatabase({ dbPath });

    await firstDatabase.prepare(`
      INSERT OR REPLACE INTO library_video_metadata_state (
        key,
        value
      ) VALUES (?, ?)
    `).run('persistence-check', 'stored');

    const reopenedDatabase = await createVideoMetadataSqliteDatabase({ dbPath });

    await expect(reopenedDatabase.prepare<{ value: string }>(`
      SELECT value
      FROM library_video_metadata_state
      WHERE key = ?
    `).get('persistence-check')).resolves.toEqual({
      value: 'stored',
    });
  });

  test('supports exec, get, all, and run through the adapted libsql client', async () => {
    const database = await createVideoMetadataSqliteDatabase({ dbPath });

    await database.exec(`
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
        'video-1',
        'Fixture',
        'Fixture description',
        120,
        '/videos/video-1/manifest.mpd',
        '/api/thumbnail/video-1',
        '["vault"]',
        '2026-03-24T00:00:00.000Z',
        1
      );
    `);

    await expect(database.prepare<{ count: number }>(`
      SELECT COUNT(*) AS count
      FROM library_videos
    `).get()).resolves.toEqual({
      count: 1,
    });
    await expect(database.prepare<{ id: string; title: string }>(`
      SELECT id, title
      FROM library_videos
      ORDER BY sort_index DESC
    `).all()).resolves.toEqual([
      expect.objectContaining({
        id: 'video-1',
        title: 'Fixture',
      }),
    ]);
    await expect(database.prepare(`
      UPDATE library_videos
      SET title = ?
      WHERE id = ?
    `).run('Updated fixture', 'video-1')).resolves.toEqual(
      expect.objectContaining({
        changes: 1,
      }),
    );
  });

  test('commits transactional bootstrap-style work atomically', async () => {
    const database = await createVideoMetadataSqliteDatabase({ dbPath });

    await database.transaction(async (transaction) => {
      await transaction.prepare(`
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
        'video-transaction',
        'Transactional fixture',
        'Transactional description',
        90,
        '/videos/video-transaction/manifest.mpd',
        '/api/thumbnail/video-transaction',
        '["vault"]',
        '2026-03-24T00:00:00.000Z',
        1,
      );
    });

    await expect(database.prepare<{ count: number }>(`
      SELECT COUNT(*) AS count
      FROM library_videos
    `).get()).resolves.toEqual({
      count: 1,
    });
  });
});
