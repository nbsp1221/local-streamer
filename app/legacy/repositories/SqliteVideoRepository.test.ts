import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import type { VideoRepository } from './interfaces/VideoRepository';
import { LegacyVideoCatalogAdapter } from '~/modules/playback/infrastructure/catalog/legacy-video-catalog.adapter';
import { DeleteVideoUseCase } from '~/legacy/modules/video/delete-video/delete-video.usecase';
import { UpdateVideoUseCase } from '~/legacy/modules/video/update-video/update-video.usecase';
import { JsonVideoRepository } from './JsonVideoRepository';
import { SqliteVideoRepository } from './SqliteVideoRepository';
import { SqliteLibraryVideoMetadataRepository } from '~/modules/library/infrastructure/sqlite/sqlite-library-video-metadata.repository';

describe('SqliteVideoRepository', () => {
  let dbPath: string;
  let tempDir: string;
  let videosJsonPath: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-sqlite-video-repo-'));
    dbPath = join(tempDir, 'video-metadata.sqlite');
    videosJsonPath = join(tempDir, 'videos.json');
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  test('bootstraps legacy JSON into SQLite and keeps update/delete/playback on the same source of truth', async () => {
    await writeFile(videosJsonPath, JSON.stringify([
      {
        createdAt: '2026-03-22T00:00:00.000Z',
        description: 'Newest legacy fixture',
        duration: 120,
        id: 'legacy-newest',
        tags: ['vault'],
        thumbnailUrl: '/api/thumbnail/legacy-newest',
        title: 'Newest legacy fixture',
        videoUrl: '/videos/legacy-newest/manifest.mpd',
      },
      {
        createdAt: '2026-03-21T00:00:00.000Z',
        description: 'Older legacy fixture',
        duration: 90,
        id: 'legacy-older',
        tags: ['Action'],
        thumbnailUrl: '/api/thumbnail/legacy-older',
        title: 'Older legacy fixture',
        videoUrl: '/videos/legacy-older/manifest.mpd',
      },
    ], null, 2));

    const bootstrapRepository = new (class extends JsonVideoRepository {
      protected readonly filePath = videosJsonPath;
    })();
    const repository = new SqliteVideoRepository({
      bootstrapRepository,
      dbPath,
    });

    await expect(repository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: 'legacy-newest' }),
      expect.objectContaining({ id: 'legacy-older' }),
    ]);

    const created = await repository.create({
      description: 'Created after bootstrap',
      duration: 75,
      id: 'sqlite-created',
      tags: ['Neo'],
      thumbnailUrl: '/api/thumbnail/sqlite-created',
      title: 'SQLite created',
      videoUrl: '/videos/sqlite-created/manifest.mpd',
    });

    await writeFile(videosJsonPath, '[]');

    const playbackCatalog = new LegacyVideoCatalogAdapter({
      repository,
    });
    const playerVideo = await playbackCatalog.getPlayerVideo('sqlite-created');
    const updateUseCase = new UpdateVideoUseCase({
      logger: console,
      videoRepository: repository,
    });
    const updateResult = await updateUseCase.execute({
      description: 'Updated through legacy use case',
      tags: ['Neo', 'vault'],
      title: 'Updated SQLite title',
      videoId: created.id,
    });
    const deleteUseCase = new DeleteVideoUseCase({
      logger: console,
      videoRepository: repository,
      workspaceManager: {
        cleanupWorkspace: async () => ({
          directoriesDeleted: [],
          errors: [],
          filesDeleted: [],
          sizeFreed: 0,
        }),
      } as never,
    });
    const deleteResult = await deleteUseCase.execute({
      videoId: created.id,
    });

    expect(playerVideo?.video.id).toBe('sqlite-created');
    expect(updateResult.success).toBe(true);
    expect(deleteResult.success).toBe(true);
    await expect(repository.findById('sqlite-created')).resolves.toBeNull();
    await expect(repository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: 'legacy-newest' }),
      expect.objectContaining({ id: 'legacy-older' }),
    ]);
  });

  test('repairs a partial bootstrap before treating SQLite as complete', async () => {
    await writeFile(videosJsonPath, JSON.stringify([
      {
        createdAt: '2026-03-22T00:00:00.000Z',
        description: 'Newest legacy fixture',
        duration: 120,
        id: 'legacy-newest',
        tags: ['vault'],
        thumbnailUrl: '/api/thumbnail/legacy-newest',
        title: 'Newest legacy fixture',
        videoUrl: '/videos/legacy-newest/manifest.mpd',
      },
      {
        createdAt: '2026-03-21T00:00:00.000Z',
        description: 'Older legacy fixture',
        duration: 90,
        id: 'legacy-older',
        tags: ['Action'],
        thumbnailUrl: '/api/thumbnail/legacy-older',
        title: 'Older legacy fixture',
        videoUrl: '/videos/legacy-older/manifest.mpd',
      },
    ], null, 2));

    const bootstrapRepository = new (class extends JsonVideoRepository {
      protected readonly filePath = videosJsonPath;
    })();
    const metadataRepository = new SqliteLibraryVideoMetadataRepository({
      dbPath,
    });

    await metadataRepository.create({
      createdAt: new Date('2026-03-22T00:00:00.000Z'),
      description: 'Newest legacy fixture',
      duration: 120,
      id: 'legacy-newest',
      sortIndex: 2,
      tags: ['vault'],
      thumbnailUrl: '/api/thumbnail/legacy-newest',
      title: 'Newest legacy fixture',
      videoUrl: '/videos/legacy-newest/manifest.mpd',
    });

    const repository = new SqliteVideoRepository({
      bootstrapRepository,
      dbPath,
      metadataRepository,
    });

    await expect(repository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: 'legacy-newest' }),
      expect.objectContaining({ id: 'legacy-older' }),
    ]);
  });

  test('retries bootstrap after a transient failure in the same process', async () => {
    const bootstrapRepository = {
      count: async () => 0,
      create: async () => {
        throw new Error('not used');
      },
      delete: async () => false,
      exists: async () => false,
      findAll: (() => {
        let attempt = 0;

        return async () => {
          attempt += 1;

          if (attempt === 1) {
            throw new Error('transient bootstrap failure');
          }

          return [
            {
              createdAt: new Date('2026-03-24T00:00:00.000Z'),
              description: 'Recovered bootstrap fixture',
              duration: 90,
              id: 'bootstrap-recovered',
              tags: ['vault'],
              thumbnailUrl: '/api/thumbnail/bootstrap-recovered',
              title: 'bootstrap-recovered',
              videoUrl: '/videos/bootstrap-recovered/manifest.mpd',
            },
          ];
        };
      })(),
      findById: async () => null,
      findByTag: async () => [],
      findByTitle: async () => [],
      getAllTags: async () => [],
      search: async () => [],
      update: async () => null,
    } satisfies VideoRepository;
    const repository = new SqliteVideoRepository({
      bootstrapRepository,
      dbPath,
    });

    await expect(repository.findAll()).rejects.toThrow('transient bootstrap failure');
    await expect(repository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: 'bootstrap-recovered' }),
    ]);
  });
});
