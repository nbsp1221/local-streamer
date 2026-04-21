import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { SqliteIngestStagedUploadRepositoryAdapter } from '../../../app/modules/ingest/infrastructure/staging/sqlite-ingest-staged-upload-repository.adapter';

const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupTasks.splice(0).map(task => task()));
});

async function createRepository() {
  const workspace = await mkdtemp(path.join(tmpdir(), 'local-streamer-staged-upload-repository-'));
  cleanupTasks.push(async () => rm(workspace, { force: true, recursive: true }));

  return new SqliteIngestStagedUploadRepositoryAdapter({
    dbPath: path.join(workspace, 'storage', 'data', 'video-metadata.sqlite'),
  });
}

describe('SqliteIngestStagedUploadRepositoryAdapter', () => {
  test('creates, loads, updates, and deletes staged uploads by stagingId', async () => {
    const repository = await createRepository();
    const created = await repository.create({
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      expiresAt: new Date('2026-04-21T00:00:00.000Z'),
      filename: 'fixture-video.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'staging-123',
      status: 'uploaded',
      storagePath: '/tmp/staging-123/video.mp4',
    });

    expect(created).toEqual({
      committedVideoId: undefined,
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      expiresAt: new Date('2026-04-21T00:00:00.000Z'),
      filename: 'fixture-video.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'staging-123',
      status: 'uploaded',
      storagePath: '/tmp/staging-123/video.mp4',
    });

    await expect(repository.findByStagingId('staging-123')).resolves.toEqual(created);

    await expect(repository.update('staging-123', {
      committedVideoId: 'video-123',
      expiresAt: new Date('2026-04-22T00:00:00.000Z'),
      status: 'committing',
    })).resolves.toEqual({
      ...created,
      committedVideoId: 'video-123',
      expiresAt: new Date('2026-04-22T00:00:00.000Z'),
      status: 'committing',
    });

    await repository.delete('staging-123');

    await expect(repository.findByStagingId('staging-123')).resolves.toBeNull();
  });

  test('stores a reserved committedVideoId once and reuses it on later reservations', async () => {
    const repository = await createRepository();
    await repository.create({
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      expiresAt: new Date('2026-04-21T00:00:00.000Z'),
      filename: 'fixture-video.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'staging-123',
      status: 'uploaded',
      storagePath: '/tmp/staging-123/video.mp4',
    });

    await expect(repository.reserveCommittedVideoId('staging-123', 'video-123')).resolves.toBe('video-123');
    await expect(repository.reserveCommittedVideoId('staging-123', 'video-999')).resolves.toBe('video-123');
    await expect(repository.findByStagingId('staging-123')).resolves.toEqual(
      expect.objectContaining({
        committedVideoId: 'video-123',
      }),
    );
  });

  test('acquires the commit transition once and reports already_committing on the second attempt', async () => {
    const repository = await createRepository();
    await repository.create({
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      expiresAt: new Date('2026-04-21T00:00:00.000Z'),
      filename: 'fixture-video.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'staging-123',
      status: 'uploaded',
      storagePath: '/tmp/staging-123/video.mp4',
    });

    await expect(repository.beginCommit('staging-123')).resolves.toBe('acquired');
    await expect(repository.beginCommit('staging-123')).resolves.toBe('already_committing');
  });

  test('lists only expired non-committed staged uploads for TTL reaping', async () => {
    const repository = await createRepository();
    await repository.create({
      createdAt: new Date('2026-04-19T00:00:00.000Z'),
      expiresAt: new Date('2026-04-19T12:00:00.000Z'),
      filename: 'expired-uploaded.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'expired-uploaded',
      status: 'uploaded',
      storagePath: '/tmp/expired-uploaded.mp4',
    });
    await repository.create({
      createdAt: new Date('2026-04-19T00:00:00.000Z'),
      expiresAt: new Date('2026-04-19T12:00:00.000Z'),
      filename: 'expired-committed.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'expired-committed',
      status: 'committed',
      storagePath: '/tmp/expired-committed.mp4',
      committedVideoId: 'video-123',
    });
    await repository.create({
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      expiresAt: new Date('2026-04-21T12:00:00.000Z'),
      filename: 'active-uploaded.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'active-uploaded',
      status: 'uploaded',
      storagePath: '/tmp/active-uploaded.mp4',
    });

    await expect(repository.listExpired(new Date('2026-04-20T12:00:00.000Z'))).resolves.toEqual([
      expect.objectContaining({
        stagingId: 'expired-uploaded',
      }),
    ]);
  });
});
