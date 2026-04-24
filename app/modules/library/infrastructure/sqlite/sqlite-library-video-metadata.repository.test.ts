import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { createVideoMetadataSqliteDatabase } from './libsql-video-metadata.database';
import { SqliteLibraryVideoMetadataRepository } from './sqlite-library-video-metadata.repository';

describe('SqliteLibraryVideoMetadataRepository', () => {
  let dbPath: string;
  let tempDir: string;
  const originalStorageDir = process.env.STORAGE_DIR;
  const originalVideoMetadataSqlitePath = process.env.VIDEO_METADATA_SQLITE_PATH;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-video-metadata-'));
    dbPath = join(tempDir, 'video-metadata.sqlite');
    process.env.STORAGE_DIR = tempDir;
    process.env.VIDEO_METADATA_SQLITE_PATH = dbPath;
  });

  afterEach(async () => {
    if (originalStorageDir === undefined) {
      delete process.env.STORAGE_DIR;
    }
    else {
      process.env.STORAGE_DIR = originalStorageDir;
    }

    if (originalVideoMetadataSqlitePath === undefined) {
      delete process.env.VIDEO_METADATA_SQLITE_PATH;
    }
    else {
      process.env.VIDEO_METADATA_SQLITE_PATH = originalVideoMetadataSqlitePath;
    }

    await rm(tempDir, { force: true, recursive: true });
  });

  test('stores records and returns newest-first order through sortIndex', async () => {
    const repository = new SqliteLibraryVideoMetadataRepository({ dbPath });

    await repository.create({
      contentTypeSlug: 'home_video',
      createdAt: new Date('2026-03-21T00:00:00.000Z'),
      description: 'Older fixture',
      duration: 90,
      genreSlugs: [],
      id: 'video-older',
      sortIndex: 1,
      tags: ['vault'],
      thumbnailUrl: '/api/thumbnail/video-older',
      title: 'Older fixture',
      videoUrl: '/videos/video-older/manifest.mpd',
    });
    await repository.create({
      contentTypeSlug: 'movie',
      createdAt: new Date('2026-03-22T00:00:00.000Z'),
      description: 'Newest fixture',
      duration: 120,
      genreSlugs: ['action'],
      id: 'video-newest',
      sortIndex: 2,
      tags: ['Action', 'vault'],
      thumbnailUrl: '/api/thumbnail/video-newest',
      title: 'Newest fixture',
      videoUrl: '/videos/video-newest/manifest.mpd',
    });

    await expect(repository.findAll()).resolves.toEqual([
      expect.objectContaining({
        contentTypeSlug: 'movie',
        genreSlugs: ['action'],
        id: 'video-newest',
        title: 'Newest fixture',
      }),
      expect.objectContaining({
        id: 'video-older',
        title: 'Older fixture',
      }),
    ]);
  });

  test('supports update, tag/title search, and delete without losing createdAt', async () => {
    const repository = new SqliteLibraryVideoMetadataRepository({ dbPath });

    const created = await repository.create({
      contentTypeSlug: 'movie',
      createdAt: new Date('2026-03-23T00:00:00.000Z'),
      description: 'Original description',
      duration: 180,
      genreSlugs: ['action', 'drama'],
      id: 'video-1',
      sortIndex: 1,
      tags: ['Action', 'Neo'],
      thumbnailUrl: '/api/thumbnail/video-1',
      title: 'Original title',
      videoUrl: '/videos/video-1/manifest.mpd',
    });

    const undefinedContentTypeUpdate = await repository.update('video-1', {
      contentTypeSlug: undefined,
      title: 'Undefined content type update',
    });

    expect(undefinedContentTypeUpdate).toEqual(expect.objectContaining({
      contentTypeSlug: 'movie',
      title: 'Undefined content type update',
    }));

    const updated = await repository.update('video-1', {
      contentTypeSlug: null,
      description: 'Updated description',
      duration: 240,
      genreSlugs: ['documentary'],
      tags: ['Neo'],
      thumbnailUrl: '/api/thumbnail/video-1-updated',
      title: 'Updated title',
      videoUrl: '/videos/video-1-updated/manifest.mpd',
    });

    expect(updated).toEqual({
      ...created,
      contentTypeSlug: undefined,
      description: 'Updated description',
      duration: 240,
      genreSlugs: ['documentary'],
      tags: ['Neo'],
      thumbnailUrl: '/api/thumbnail/video-1-updated',
      title: 'Updated title',
      videoUrl: '/videos/video-1-updated/manifest.mpd',
    });
    await expect(repository.findByTitle('updated')).resolves.toEqual([
      expect.objectContaining({ id: 'video-1' }),
    ]);
    await expect(repository.findByTag('neo')).resolves.toEqual([
      expect.objectContaining({ id: 'video-1' }),
    ]);
    await expect(repository.search('updated')).resolves.toEqual([
      expect.objectContaining({ id: 'video-1' }),
    ]);
    await expect(repository.getAllTags()).resolves.toEqual(['Neo']);
    await expect(repository.exists('video-1')).resolves.toBe(true);
    await expect(repository.count()).resolves.toBe(1);

    await expect(repository.delete('video-1')).resolves.toBe(true);
    await expect(repository.findById('video-1')).resolves.toBeNull();
    await expect(repository.count()).resolves.toBe(0);
  });

  test('lists active vocabulary rows without exposing inactive values', async () => {
    const database = await createVideoMetadataSqliteDatabase({ dbPath });
    const repository = new SqliteLibraryVideoMetadataRepository({ dbPath });

    await database.prepare(`
      UPDATE video_genres SET active = 0 WHERE slug = ?
    `).run('animation');

    await expect(repository.listActiveContentTypes()).resolves.toEqual([
      { active: true, label: 'Movie', slug: 'movie', sortOrder: 10 },
      { active: true, label: 'Episode', slug: 'episode', sortOrder: 20 },
      { active: true, label: 'Home video', slug: 'home_video', sortOrder: 30 },
      { active: true, label: 'Clip', slug: 'clip', sortOrder: 40 },
      { active: true, label: 'Other', slug: 'other', sortOrder: 50 },
    ]);
    await expect(repository.listActiveGenres()).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: 'animation' }),
      ]),
    );
  });
});
