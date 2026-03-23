import { beforeEach, describe, expect, test, vi } from 'vitest';

const analyzeMock = vi.fn();
const createWorkspaceMock = vi.fn();
const cleanupWorkspaceMock = vi.fn();
const fileExistsMock = vi.fn();
const getWorkspaceMock = vi.fn();
const moveToWorkspaceMock = vi.fn();
const renameMock = vi.fn();
const transcodeMock = vi.fn();
const migrateExistingThumbnailMock = vi.fn();
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

vi.mock('~/legacy/modules/video/transcoding', () => ({
  FFmpegVideoTranscoderAdapter: vi.fn(() => ({
    transcode: transcodeMock,
  })),
}));

vi.mock('~/legacy/modules/thumbnail/shared/thumbnail-generator-encrypted.server', () => ({
  encryptedThumbnailGenerator: {
    migrateExistingThumbnail: migrateExistingThumbnailMock,
  },
}));

describe('ingest legacy library intake', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('prepares the video with the injected video id and returns duration before metadata persistence', async () => {
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

    const { createIngestLegacyLibraryIntake } = await import('../../../app/composition/server/ingest-legacy-library-intake');
    const intake = createIngestLegacyLibraryIntake();
    const prepared = await intake.prepareVideoForLibrary({
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

  test('processes the prepared video with the same injected video id and preserves partial success semantics', async () => {
    transcodeMock.mockResolvedValue({
      error: new Error('transcode failed'),
      success: false,
    });

    const { createIngestLegacyLibraryIntake } = await import('../../../app/composition/server/ingest-legacy-library-intake');
    const intake = createIngestLegacyLibraryIntake();
    const result = await intake.processPreparedVideo({
      encodingOptions: {
        encoder: 'gpu-h265',
      },
      sourcePath: '/videos/video-123/video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    });

    expect(transcodeMock).toHaveBeenCalledWith({
      codecFamily: 'h265',
      quality: 'high',
      sourcePath: '/videos/video-123/video.mp4',
      useGpu: true,
      videoId: 'video-123',
    });
    expect(migrateExistingThumbnailMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      dashEnabled: false,
      message: 'Video added to library but video conversion failed',
    });
  });

  test('finalizes a successfully persisted prepared video by encrypting the workspace thumbnail after metadata write', async () => {
    migrateExistingThumbnailMock.mockResolvedValue({
      success: true,
    });

    const { createIngestLegacyLibraryIntake } = await import('../../../app/composition/server/ingest-legacy-library-intake');
    const intake = createIngestLegacyLibraryIntake();
    await intake.finalizeSuccessfulPreparedVideo({
      title: 'Fixture Video',
      videoId: 'video-123',
    });

    expect(migrateExistingThumbnailMock).toHaveBeenCalledWith('video-123');
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

    const { createIngestLegacyLibraryIntake } = await import('../../../app/composition/server/ingest-legacy-library-intake');
    const intake = createIngestLegacyLibraryIntake();
    await intake.recoverFailedPreparedVideo({
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
    expect(migrateExistingThumbnailMock).not.toHaveBeenCalled();
    expect(fileExistsMock).toHaveBeenCalledWith('/videos/video-123/video.mp4');
    expect(fileExistsMock).toHaveBeenCalledWith('/videos/video-123/thumbnail.jpg');
    expect(accessMock).not.toHaveBeenCalled();
  });

  test('recovers a failed preparation by restoring any moved artifacts and rethrowing the original error', async () => {
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
      .mockResolvedValueOnce(false);
    cleanupWorkspaceMock.mockResolvedValue({
      directoriesDeleted: ['/videos/video-123'],
      errors: [],
      filesDeleted: [],
      sizeFreed: 1_024,
    });

    const { createIngestLegacyLibraryIntake } = await import('../../../app/composition/server/ingest-legacy-library-intake');
    const intake = createIngestLegacyLibraryIntake();

    await expect(intake.prepareVideoForLibrary({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    })).rejects.toThrow('Failed to move file to workspace: disk full');

    expect(getWorkspaceMock).toHaveBeenCalledWith('video-123');
    expect(cleanupWorkspaceMock).toHaveBeenCalledWith('video-123');
    expect(renameMock).not.toHaveBeenCalled();
    expect(fileExistsMock).toHaveBeenCalledWith('/videos/video-123/video.mp4');
    expect(fileExistsMock).toHaveBeenCalledWith('/videos/video-123/thumbnail.jpg');
    expect(analyzeMock).not.toHaveBeenCalled();
    expect(migrateExistingThumbnailMock).not.toHaveBeenCalled();
    expect(accessMock).not.toHaveBeenCalled();
  });

  test('restores the upload and cleans the workspace when thumbnail analysis fails during preparation', async () => {
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
    analyzeMock.mockRejectedValue(new Error('ffprobe failed'));
    getWorkspaceMock.mockResolvedValue({
      rootDir: '/videos/video-123',
      thumbnailPath: '/videos/video-123/thumbnail.jpg',
      videoId: 'video-123',
    });
    fileExistsMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    cleanupWorkspaceMock.mockResolvedValue({
      directoriesDeleted: ['/videos/video-123'],
      errors: [],
      filesDeleted: [],
      sizeFreed: 1_024,
    });

    const { createIngestLegacyLibraryIntake } = await import('../../../app/composition/server/ingest-legacy-library-intake');
    const intake = createIngestLegacyLibraryIntake();

    await expect(intake.prepareVideoForLibrary({
      filename: 'fixture-video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
    })).rejects.toThrow('ffprobe failed');

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
    expect(migrateExistingThumbnailMock).not.toHaveBeenCalled();
    expect(fileExistsMock).toHaveBeenCalledWith('/videos/video-123/video.mp4');
    expect(fileExistsMock).toHaveBeenCalledWith('/videos/video-123/thumbnail.jpg');
    expect(accessMock).not.toHaveBeenCalled();
    expect(analyzeMock).toHaveBeenCalledWith('/videos/video-123/video.mp4');
  });
});
