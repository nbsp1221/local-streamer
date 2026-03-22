import { beforeEach, describe, expect, test, vi } from 'vitest';

const analyzeMock = vi.fn();
const createWorkspaceMock = vi.fn();
const moveToWorkspaceMock = vi.fn();
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
    createWorkspace: createWorkspaceMock,
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
    migrateExistingThumbnailMock.mockResolvedValue({
      success: true,
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
    expect(migrateExistingThumbnailMock).toHaveBeenCalledWith('video-123');
    expect(result).toEqual({
      dashEnabled: false,
      message: 'Video added to library but video conversion failed',
    });
  });
});
