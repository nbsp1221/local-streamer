import { beforeEach, describe, expect, test, vi } from 'vitest';

const analyzeMock = vi.fn();
const createWorkspaceMock = vi.fn();
const cleanupWorkspaceMock = vi.fn();
const fileExistsMock = vi.fn();
const getWorkspaceMock = vi.fn();
const moveToWorkspaceMock = vi.fn();
const renameMock = vi.fn();
const accessMock = vi.fn();

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();

  return {
    ...actual,
    promises: {
      ...actual.promises,
      access: accessMock,
      mkdir: vi.fn(async () => undefined),
      rename: renameMock,
      rm: vi.fn(async () => undefined),
    },
  };
});

vi.mock('~/legacy/modules/video/analysis/ffprobe-analysis.service', () => ({
  FFprobeAnalysisService: vi.fn(() => ({
    analyze: analyzeMock,
  })),
}));

vi.mock('~/legacy/modules/video/storage/services/WorkspaceManagerService', () => ({
  workspaceManagerService: {
    cleanupWorkspace: cleanupWorkspaceMock,
    createWorkspace: createWorkspaceMock,
    fileExists: fileExistsMock,
    getWorkspace: getWorkspaceMock,
    moveToWorkspace: moveToWorkspaceMock,
  },
}));

describe('ingest legacy prepared-video workspace', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('prepares the uploaded video in the workspace and returns source path plus duration', async () => {
    accessMock.mockResolvedValue(undefined);
    createWorkspaceMock.mockResolvedValue({
      rootDir: '/videos/video-123',
      thumbnailPath: '/videos/video-123/thumbnail.jpg',
      videoId: 'video-123',
    });
    moveToWorkspaceMock
      .mockResolvedValueOnce({
        destination: '/videos/video-123/video.mp4',
        success: true,
      })
      .mockResolvedValueOnce({
        destination: '/videos/video-123/thumbnail.jpg',
        success: true,
      });
    analyzeMock.mockResolvedValue({
      duration: 120,
      fileSize: 1_024,
    });

    const { createIngestLegacyPreparedVideoWorkspace } = await import('../../../app/composition/server/ingest-legacy-prepared-video-workspace');
    const workspace = createIngestLegacyPreparedVideoWorkspace();
    const prepared = await workspace.preparePreparedVideo({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    });

    expect(createWorkspaceMock).toHaveBeenCalledWith({
      cleanupOnError: true,
      temporary: false,
      videoId: 'video-123',
    });
    expect(moveToWorkspaceMock).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/storage/uploads/fixture-video.mp4'),
      expect.objectContaining({ videoId: 'video-123' }),
      'video.mp4',
    );
    expect(moveToWorkspaceMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/storage/uploads/thumbnails/fixture-video.jpg'),
      expect.objectContaining({ videoId: 'video-123' }),
      'thumbnail.jpg',
    );
    expect(analyzeMock).toHaveBeenCalledWith('/videos/video-123/video.mp4');
    expect(prepared).toEqual({
      duration: 120,
      sourcePath: '/videos/video-123/video.mp4',
    });
  });

  test('recovers a failed prepared video by restoring the upload and cleaning the workspace', async () => {
    fileExistsMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    getWorkspaceMock.mockResolvedValue({
      rootDir: '/videos/video-123',
      thumbnailPath: '/videos/video-123/thumbnail.jpg',
      videoId: 'video-123',
    });
    cleanupWorkspaceMock.mockResolvedValue({
      directoriesDeleted: ['/videos/video-123'],
      errors: [],
      filesDeleted: [],
      sizeFreed: 1_024,
    });

    const { createIngestLegacyPreparedVideoWorkspace } = await import('../../../app/composition/server/ingest-legacy-prepared-video-workspace');
    const workspace = createIngestLegacyPreparedVideoWorkspace();
    await workspace.recoverPreparedVideo({
      filename: 'fixture-video.mp4',
      videoId: 'video-123',
    });

    expect(getWorkspaceMock).toHaveBeenCalledWith('video-123');
    expect(renameMock).toHaveBeenNthCalledWith(
      1,
      '/videos/video-123/video.mp4',
      expect.stringContaining('/storage/uploads/fixture-video.mp4'),
    );
    expect(renameMock).toHaveBeenNthCalledWith(
      2,
      '/videos/video-123/thumbnail.jpg',
      expect.stringContaining('/storage/uploads/thumbnails/fixture-video.jpg'),
    );
    expect(cleanupWorkspaceMock).toHaveBeenCalledWith('video-123');
  });

  test('adds prepare-stage recovery context when preparation fails after a workspace move attempt', async () => {
    createWorkspaceMock.mockResolvedValue({
      rootDir: '/videos/video-123',
      thumbnailPath: '/videos/video-123/thumbnail.jpg',
      videoId: 'video-123',
    });
    moveToWorkspaceMock.mockResolvedValueOnce({
      error: 'disk full',
      success: false,
    });
    getWorkspaceMock.mockResolvedValue({
      rootDir: '/videos/video-123',
      thumbnailPath: '/videos/video-123/thumbnail.jpg',
      videoId: 'video-123',
    });
    fileExistsMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);
    cleanupWorkspaceMock.mockResolvedValue({
      directoriesDeleted: ['/videos/video-123'],
      errors: [],
      filesDeleted: [],
      sizeFreed: 1_024,
    });

    const { createIngestLegacyPreparedVideoWorkspace } = await import('../../../app/composition/server/ingest-legacy-prepared-video-workspace');
    const workspace = createIngestLegacyPreparedVideoWorkspace();
    let caughtError: (Error & {
      addToLibraryStage?: string;
      recoveryResult?: {
        restoredThumbnail?: boolean;
        retryAvailability?: string;
      };
    }) | null = null;

    try {
      await workspace.preparePreparedVideo({
        filename: 'fixture-video.mp4',
        title: 'Fixture Video',
        videoId: 'video-123',
      });
    }
    catch (error) {
      caughtError = error as Error & {
        addToLibraryStage?: string;
        recoveryResult?: {
          restoredThumbnail?: boolean;
          retryAvailability?: string;
        };
      };
    }

    expect(caughtError).not.toBeNull();
    expect(caughtError?.message).toBe('Failed to move file to workspace: disk full');
    expect(caughtError?.addToLibraryStage).toBe('prepare');
    expect(caughtError?.recoveryResult).toEqual({
      restoredThumbnail: false,
      retryAvailability: 'unavailable',
    });
  });
});
