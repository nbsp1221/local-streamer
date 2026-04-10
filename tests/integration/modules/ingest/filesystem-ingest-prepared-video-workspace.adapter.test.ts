import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

describe('FilesystemIngestPreparedVideoWorkspaceAdapter', () => {
  let rootDir = '';

  afterEach(async () => {
    if (rootDir) {
      await rm(rootDir, { force: true, recursive: true });
      rootDir = '';
    }
  });

  test('prepares the uploaded video in the workspace and returns source path plus duration', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-prepared-workspace-'));
    const storageDir = path.join(rootDir, 'storage');
    const uploadsDir = path.join(storageDir, 'uploads');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
    const videosDir = path.join(storageDir, 'data', 'videos');
    await mkdir(thumbnailsDir, { recursive: true });
    await mkdir(videosDir, { recursive: true });
    await writeFile(path.join(uploadsDir, 'fixture-video.mp4'), 'video-data');
    await writeFile(path.join(thumbnailsDir, 'fixture-video.jpg'), 'thumbnail-data');
    const analyze = vi.fn(async () => ({
      duration: 120,
    }));

    const { FilesystemIngestPreparedVideoWorkspaceAdapter } = await import('../../../../app/modules/ingest/infrastructure/workspace/filesystem-ingest-prepared-video-workspace.adapter');
    const adapter = new FilesystemIngestPreparedVideoWorkspaceAdapter({
      storagePaths: {
        pendingJsonPath: path.join(storageDir, 'data', 'pending.json'),
        storageDir,
        thumbnailsDir,
        uploadsDir,
        videosDir,
      },
      videoAnalysis: {
        analyze,
      },
    });

    const prepared = await adapter.preparePreparedVideo({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    });

    expect(analyze).toHaveBeenCalledWith(path.join(videosDir, 'video-123', 'video.mp4'));
    expect(prepared).toEqual({
      duration: 120,
      sourcePath: path.join(videosDir, 'video-123', 'video.mp4'),
    });
    await expect(readFile(path.join(videosDir, 'video-123', 'video.mp4'), 'utf8')).resolves.toBe('video-data');
    await expect(readFile(path.join(videosDir, 'video-123', 'thumbnail.jpg'), 'utf8')).resolves.toBe('thumbnail-data');
    await expect(access(path.join(videosDir, 'video-123', 'video'))).resolves.toBeUndefined();
    await expect(access(path.join(videosDir, 'video-123', 'audio'))).resolves.toBeUndefined();
    await expect(access(path.join(videosDir, 'video-123', 'temp'))).resolves.toBeUndefined();
  });

  test('recovers a failed prepared video by restoring upload and thumbnail then cleaning the workspace', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-prepared-workspace-'));
    const storageDir = path.join(rootDir, 'storage');
    const uploadsDir = path.join(storageDir, 'uploads');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
    const videosDir = path.join(storageDir, 'data', 'videos');
    const workspaceRoot = path.join(videosDir, 'video-123');
    await mkdir(thumbnailsDir, { recursive: true });
    await mkdir(workspaceRoot, { recursive: true });
    await writeFile(path.join(workspaceRoot, 'video.mp4'), 'video-data');
    await writeFile(path.join(workspaceRoot, 'thumbnail.jpg'), 'thumbnail-data');

    const { FilesystemIngestPreparedVideoWorkspaceAdapter } = await import('../../../../app/modules/ingest/infrastructure/workspace/filesystem-ingest-prepared-video-workspace.adapter');
    const adapter = new FilesystemIngestPreparedVideoWorkspaceAdapter({
      storagePaths: {
        pendingJsonPath: path.join(storageDir, 'data', 'pending.json'),
        storageDir,
        thumbnailsDir,
        uploadsDir,
        videosDir,
      },
      videoAnalysis: {
        analyze: vi.fn(),
      },
    });

    await expect(adapter.recoverPreparedVideo({
      filename: 'fixture-video.mp4',
      videoId: 'video-123',
    })).resolves.toEqual({
      restoredThumbnail: true,
      retryAvailability: 'restored',
    });
    await expect(readFile(path.join(uploadsDir, 'fixture-video.mp4'), 'utf8')).resolves.toBe('video-data');
    await expect(readFile(path.join(thumbnailsDir, 'fixture-video.jpg'), 'utf8')).resolves.toBe('thumbnail-data');
    await expect(access(workspaceRoot)).rejects.toThrow();
  });

  test('treats an already-available destination thumbnail as restored during recovery', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-prepared-workspace-'));
    const storageDir = path.join(rootDir, 'storage');
    const uploadsDir = path.join(storageDir, 'uploads');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
    const videosDir = path.join(storageDir, 'data', 'videos');
    const workspaceRoot = path.join(videosDir, 'video-123');
    await mkdir(thumbnailsDir, { recursive: true });
    await mkdir(workspaceRoot, { recursive: true });
    await writeFile(path.join(workspaceRoot, 'video.mp4'), 'video-data');
    await writeFile(path.join(thumbnailsDir, 'fixture-video.jpg'), 'existing-thumbnail');

    const { FilesystemIngestPreparedVideoWorkspaceAdapter } = await import('../../../../app/modules/ingest/infrastructure/workspace/filesystem-ingest-prepared-video-workspace.adapter');
    const adapter = new FilesystemIngestPreparedVideoWorkspaceAdapter({
      storagePaths: {
        pendingJsonPath: path.join(storageDir, 'data', 'pending.json'),
        storageDir,
        thumbnailsDir,
        uploadsDir,
        videosDir,
      },
      videoAnalysis: {
        analyze: vi.fn(),
      },
    });

    await expect(adapter.recoverPreparedVideo({
      filename: 'fixture-video.mp4',
      videoId: 'video-123',
    })).resolves.toEqual({
      restoredThumbnail: true,
      retryAvailability: 'restored',
    });
    await expect(readFile(path.join(thumbnailsDir, 'fixture-video.jpg'), 'utf8')).resolves.toBe('existing-thumbnail');
  });

  test('attaches prepare-stage recovery context when analysis fails after the upload move', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-prepared-workspace-'));
    const storageDir = path.join(rootDir, 'storage');
    const uploadsDir = path.join(storageDir, 'uploads');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
    const videosDir = path.join(storageDir, 'data', 'videos');
    await mkdir(thumbnailsDir, { recursive: true });
    await mkdir(videosDir, { recursive: true });
    await writeFile(path.join(uploadsDir, 'fixture-video.mp4'), 'video-data');

    const { FilesystemIngestPreparedVideoWorkspaceAdapter } = await import('../../../../app/modules/ingest/infrastructure/workspace/filesystem-ingest-prepared-video-workspace.adapter');
    const adapter = new FilesystemIngestPreparedVideoWorkspaceAdapter({
      storagePaths: {
        pendingJsonPath: path.join(storageDir, 'data', 'pending.json'),
        storageDir,
        thumbnailsDir,
        uploadsDir,
        videosDir,
      },
      videoAnalysis: {
        analyze: vi.fn(async () => {
          throw new Error('ffprobe failed');
        }),
      },
    });

    await expect(adapter.preparePreparedVideo({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    })).rejects.toMatchObject({
      addToLibraryStage: 'prepare',
      message: 'ffprobe failed',
      recoveryResult: {
        restoredThumbnail: false,
        retryAvailability: 'restored',
      },
    });
    await expect(readFile(path.join(uploadsDir, 'fixture-video.mp4'), 'utf8')).resolves.toBe('video-data');
  });

  test('degrades to unavailable recovery context when prepare-stage recovery also fails', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-prepared-workspace-'));
    const storageDir = path.join(rootDir, 'storage');
    const uploadsDir = path.join(storageDir, 'uploads');
    const thumbnailsDir = path.join(uploadsDir, 'thumbnails');
    const videosDir = path.join(storageDir, 'data', 'videos');
    await mkdir(thumbnailsDir, { recursive: true });
    await mkdir(videosDir, { recursive: true });
    await writeFile(path.join(uploadsDir, 'fixture-video.mp4'), 'video-data');

    const { FilesystemIngestPreparedVideoWorkspaceAdapter } = await import('../../../../app/modules/ingest/infrastructure/workspace/filesystem-ingest-prepared-video-workspace.adapter');
    const adapter = new FilesystemIngestPreparedVideoWorkspaceAdapter({
      storagePaths: {
        pendingJsonPath: path.join(storageDir, 'data', 'pending.json'),
        storageDir,
        thumbnailsDir,
        uploadsDir,
        videosDir,
      },
      videoAnalysis: {
        analyze: vi.fn(async () => {
          throw new Error('ffprobe failed');
        }),
      },
    });
    vi.spyOn(adapter, 'recoverPreparedVideo').mockRejectedValue(new Error('recovery failed'));

    await expect(adapter.preparePreparedVideo({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    })).rejects.toMatchObject({
      addToLibraryStage: 'prepare',
      message: 'ffprobe failed',
      recoveryResult: {
        restoredThumbnail: false,
        retryAvailability: 'unavailable',
      },
    });
  });
});
