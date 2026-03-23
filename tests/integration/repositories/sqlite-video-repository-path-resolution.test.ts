import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupTasks.splice(0).map(task => task()));
  delete process.env.STORAGE_DIR;
  delete process.env.VIDEO_METADATA_SQLITE_PATH;
});

async function seedStorage(storageDir: string, videoId: string) {
  const dataDir = join(storageDir, 'data');
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, 'videos.json'), JSON.stringify([
    {
      createdAt: '2026-03-24T00:00:00.000Z',
      description: `Fixture for ${videoId}`,
      duration: 90,
      id: videoId,
      tags: ['vault'],
      thumbnailUrl: `/api/thumbnail/${videoId}`,
      title: videoId,
      videoUrl: `/videos/${videoId}/manifest.mpd`,
    },
  ], null, 2));
}

describe('SqliteVideoRepository path resolution', () => {
  test('derives bootstrap JSON and SQLite paths from the current workspace at construction time', async () => {
    const workspaceOne = await mkdtemp(join(tmpdir(), 'local-streamer-repo-path-1-'));
    const workspaceTwo = await mkdtemp(join(tmpdir(), 'local-streamer-repo-path-2-'));
    cleanupTasks.push(async () => rm(workspaceOne, { force: true, recursive: true }));
    cleanupTasks.push(async () => rm(workspaceTwo, { force: true, recursive: true }));

    const storageOne = join(workspaceOne, 'storage');
    const storageTwo = join(workspaceTwo, 'storage');
    await seedStorage(storageOne, 'workspace-one-video');
    await seedStorage(storageTwo, 'workspace-two-video');

    process.env.STORAGE_DIR = storageOne;
    process.env.VIDEO_METADATA_SQLITE_PATH = join(storageOne, 'data', 'video-metadata.sqlite');
    vi.resetModules();

    const { SqliteVideoRepository } = await import('../../../app/legacy/repositories/SqliteVideoRepository');
    const firstRepository = new SqliteVideoRepository();

    await expect(firstRepository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: 'workspace-one-video' }),
    ]);

    process.env.STORAGE_DIR = storageTwo;
    process.env.VIDEO_METADATA_SQLITE_PATH = join(storageTwo, 'data', 'video-metadata.sqlite');

    const secondRepository = new SqliteVideoRepository();

    await expect(secondRepository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: 'workspace-two-video' }),
    ]);
  });

  test('keeps the real getVideoRepository factory path aligned with the current workspace after clearInstances', async () => {
    const workspaceOne = await mkdtemp(join(tmpdir(), 'local-streamer-factory-path-1-'));
    const workspaceTwo = await mkdtemp(join(tmpdir(), 'local-streamer-factory-path-2-'));
    cleanupTasks.push(async () => rm(workspaceOne, { force: true, recursive: true }));
    cleanupTasks.push(async () => rm(workspaceTwo, { force: true, recursive: true }));

    const storageOne = join(workspaceOne, 'storage');
    const storageTwo = join(workspaceTwo, 'storage');
    await seedStorage(storageOne, 'factory-one-video');
    await seedStorage(storageTwo, 'factory-two-video');

    process.env.STORAGE_DIR = storageOne;
    process.env.VIDEO_METADATA_SQLITE_PATH = join(storageOne, 'data', 'video-metadata.sqlite');
    vi.resetModules();

    const { getVideoRepository, repositoryFactory } = await import('../../../app/legacy/repositories');
    const firstRepository = getVideoRepository();

    await expect(firstRepository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: 'factory-one-video' }),
    ]);

    process.env.STORAGE_DIR = storageTwo;
    process.env.VIDEO_METADATA_SQLITE_PATH = join(storageTwo, 'data', 'video-metadata.sqlite');
    repositoryFactory.clearInstances();

    const secondRepository = getVideoRepository();

    await expect(secondRepository.findAll()).resolves.toEqual([
      expect.objectContaining({ id: 'factory-two-video' }),
    ]);
  });
});
