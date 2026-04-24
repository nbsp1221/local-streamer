import { describe, expect, test, vi } from 'vitest';
import type { IngestVideoProcessingPort } from '../ports/ingest-video-processing.port';
import { CommitStagedUploadToLibraryUseCase } from './commit-staged-upload-to-library.usecase';

function createVideoProcessing(input: {
  finalizeSuccessfulVideo?: IngestVideoProcessingPort['finalizeSuccessfulVideo'];
  processPreparedVideo: IngestVideoProcessingPort['processPreparedVideo'];
}): IngestVideoProcessingPort {
  return {
    finalizeSuccessfulVideo: input.finalizeSuccessfulVideo ?? (async () => undefined),
    processPreparedVideo: input.processPreparedVideo,
  };
}

describe('CommitStagedUploadToLibraryUseCase', () => {
  test('commits an uploaded staged file into the library and marks the row committed', async () => {
    const findByStagingId = vi.fn(async () => ({
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      expiresAt: new Date('2026-04-21T00:00:00.000Z'),
      filename: 'fixture-video.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'staging-123',
      status: 'uploaded' as const,
      storagePath: '/tmp/staging-123/video.mp4',
    }));
    const beginCommit = vi.fn(async () => 'acquired' as const);
    const reserveCommittedVideoId = vi.fn(async () => 'video-123');
    const update = vi.fn(async (_stagingId, input) => ({
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      expiresAt: new Date('2026-04-21T00:00:00.000Z'),
      filename: 'fixture-video.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'staging-123',
      status: input.status ?? 'uploaded',
      storagePath: '/tmp/staging-123/video.mp4',
      committedVideoId: input.committedVideoId,
    }));
    const processPreparedVideo = vi.fn(async () => ({
      dashEnabled: true,
      message: 'Video added to library successfully with video conversion',
    }));
    const finalizeSuccessfulVideo = vi.fn(async () => undefined);
    const analyze = vi.fn(async () => ({
      duration: 120,
    }));
    const writeVideoRecord = vi.fn(async () => undefined);
    const deleteStorage = vi.fn(async () => undefined);
    const executeReaper = vi.fn(async () => ({
      deletedCount: 0,
    }));
    const useCase = new CommitStagedUploadToLibraryUseCase({
      reapExpiredStagedUploads: {
        execute: executeReaper,
      },
      stagedUploadRepository: {
        beginCommit,
        create: vi.fn(),
        delete: vi.fn(),
        findByStagingId,
        listExpired: vi.fn(),
        reserveCommittedVideoId,
        update,
      },
      stagedUploadStorage: {
        delete: deleteStorage,
        deleteTemp: vi.fn(),
        promote: vi.fn(),
      },
      videoAnalysis: {
        analyze,
      },
      videoMetadataWriter: {
        writeVideoRecord,
      },
      videoProcessing: createVideoProcessing({
        finalizeSuccessfulVideo,
        processPreparedVideo,
      }),
    });

    await expect(useCase.execute({
      contentTypeSlug: ' Movie ',
      description: 'A test upload',
      encodingOptions: {
        encoder: 'cpu-h264',
      },
      genreSlugs: ['Drama', 'Action'],
      stagingId: 'staging-123',
      tags: ['fixture', 'Good Boy-comedy', 'good_boy-comedy'],
      title: 'Fixture Video',
    })).resolves.toEqual({
      ok: true,
      data: {
        dashEnabled: true,
        message: 'Video added to library successfully with video conversion',
        videoId: 'video-123',
      },
    });

    expect(executeReaper).toHaveBeenCalledOnce();
    expect(beginCommit).toHaveBeenCalledWith('staging-123');
    expect(reserveCommittedVideoId).toHaveBeenCalledWith('staging-123', expect.any(String));
    expect(analyze).toHaveBeenCalledWith('/tmp/staging-123/video.mp4');
    expect(processPreparedVideo).toHaveBeenCalledWith({
      encodingOptions: {
        encoder: 'cpu-h264',
      },
      sourcePath: '/tmp/staging-123/video.mp4',
      title: 'Fixture Video',
      videoId: 'video-123',
      workspaceRootDir: expect.any(String),
    });
    expect(writeVideoRecord).toHaveBeenCalledWith({
      contentTypeSlug: 'movie',
      description: 'A test upload',
      duration: 120,
      genreSlugs: ['drama', 'action'],
      id: 'video-123',
      tags: ['fixture', 'good_boy-comedy'],
      thumbnailUrl: '/api/thumbnail/video-123',
      title: 'Fixture Video',
      videoUrl: '/videos/video-123/manifest.mpd',
    });
    expect(update).toHaveBeenNthCalledWith(1, 'staging-123', {
      committedVideoId: 'video-123',
      status: 'committed',
    });
    expect(deleteStorage).toHaveBeenCalledWith('/tmp/staging-123/video.mp4');
    expect(finalizeSuccessfulVideo).toHaveBeenCalledWith({
      title: 'Fixture Video',
      videoId: 'video-123',
    });
  });

  test('returns the existing videoId when the staged upload is already committed', async () => {
    const useCase = new CommitStagedUploadToLibraryUseCase({
      reapExpiredStagedUploads: {
        execute: vi.fn(async () => ({ deletedCount: 0 })),
      },
      stagedUploadRepository: {
        beginCommit: vi.fn(async () => 'already_committed' as const),
        create: vi.fn(),
        delete: vi.fn(),
        findByStagingId: vi.fn(async () => ({
          committedVideoId: 'video-123',
          createdAt: new Date('2026-04-20T00:00:00.000Z'),
          expiresAt: new Date('2026-04-21T00:00:00.000Z'),
          filename: 'fixture-video.mp4',
          mimeType: 'video/mp4',
          size: 1_024,
          stagingId: 'staging-123',
          status: 'committed' as const,
          storagePath: '/tmp/staging-123/video.mp4',
        })),
        listExpired: vi.fn(),
        reserveCommittedVideoId: vi.fn(),
        update: vi.fn(),
      },
      stagedUploadStorage: {
        delete: vi.fn(),
        deleteTemp: vi.fn(),
        promote: vi.fn(),
      },
      videoAnalysis: {
        analyze: vi.fn(),
      },
      videoMetadataWriter: {
        writeVideoRecord: vi.fn(),
      },
      videoProcessing: createVideoProcessing({
        processPreparedVideo: vi.fn(),
      }),
    });

    await expect(useCase.execute({
      stagingId: 'staging-123',
      tags: [],
      title: 'Fixture Video',
    })).resolves.toEqual({
      ok: true,
      data: {
        dashEnabled: true,
        message: 'Video already committed',
        videoId: 'video-123',
      },
    });
  });

  test('returns unavailable and restores the row to uploaded when processing fails', async () => {
    const update = vi.fn(async (_stagingId, input) => ({
      createdAt: new Date('2026-04-20T00:00:00.000Z'),
      expiresAt: new Date('2026-04-21T00:00:00.000Z'),
      filename: 'fixture-video.mp4',
      mimeType: 'video/mp4',
      size: 1_024,
      stagingId: 'staging-123',
      status: input.status ?? 'uploaded',
      storagePath: '/tmp/staging-123/video.mp4',
      committedVideoId: 'video-123',
    }));
    const beginCommit = vi.fn(async () => 'acquired' as const);
    const deleteStorage = vi.fn(async () => undefined);
    const useCase = new CommitStagedUploadToLibraryUseCase({
      reapExpiredStagedUploads: {
        execute: vi.fn(async () => ({ deletedCount: 0 })),
      },
      stagedUploadRepository: {
        beginCommit,
        create: vi.fn(),
        delete: vi.fn(),
        findByStagingId: vi.fn(async () => ({
          createdAt: new Date('2026-04-20T00:00:00.000Z'),
          expiresAt: new Date('2026-04-21T00:00:00.000Z'),
          filename: 'fixture-video.mp4',
          mimeType: 'video/mp4',
          size: 1_024,
          stagingId: 'staging-123',
          status: 'uploaded' as const,
          storagePath: '/tmp/staging-123/video.mp4',
        })),
        listExpired: vi.fn(),
        reserveCommittedVideoId: vi.fn(async () => 'video-123'),
        update,
      },
      stagedUploadStorage: {
        delete: deleteStorage,
        deleteTemp: vi.fn(),
        promote: vi.fn(),
      },
      videoAnalysis: {
        analyze: vi.fn(async () => ({
          duration: 120,
        })),
      },
      videoMetadataWriter: {
        writeVideoRecord: vi.fn(),
      },
      videoProcessing: createVideoProcessing({
        processPreparedVideo: vi.fn(async () => ({
          dashEnabled: false,
          message: 'Video conversion failed',
        })),
      }),
    });

    await expect(useCase.execute({
      stagingId: 'staging-123',
      tags: [],
      title: 'Fixture Video',
    })).resolves.toEqual({
      ok: false,
      message: 'Video conversion failed',
      reason: 'COMMIT_STAGED_UPLOAD_UNAVAILABLE',
    });
    expect(beginCommit).toHaveBeenCalledWith('staging-123');
    expect(update).toHaveBeenNthCalledWith(1, 'staging-123', {
      status: 'uploaded',
    });
    expect(deleteStorage).not.toHaveBeenCalled();
  });

  test('returns a conflict when another commit already holds the staged upload', async () => {
    const useCase = new CommitStagedUploadToLibraryUseCase({
      reapExpiredStagedUploads: {
        execute: vi.fn(async () => ({ deletedCount: 0 })),
      },
      stagedUploadRepository: {
        beginCommit: vi.fn(async () => 'already_committing' as const),
        create: vi.fn(),
        delete: vi.fn(),
        findByStagingId: vi.fn(async () => ({
          createdAt: new Date('2026-04-20T00:00:00.000Z'),
          expiresAt: new Date('2026-04-21T00:00:00.000Z'),
          filename: 'fixture-video.mp4',
          mimeType: 'video/mp4',
          size: 1_024,
          stagingId: 'staging-123',
          status: 'uploaded' as const,
          storagePath: '/tmp/staging-123/video.mp4',
        })),
        listExpired: vi.fn(),
        reserveCommittedVideoId: vi.fn(),
        update: vi.fn(),
      },
      stagedUploadStorage: {
        delete: vi.fn(),
        deleteTemp: vi.fn(),
        promote: vi.fn(),
      },
      videoAnalysis: {
        analyze: vi.fn(),
      },
      videoMetadataWriter: {
        writeVideoRecord: vi.fn(),
      },
      videoProcessing: createVideoProcessing({
        processPreparedVideo: vi.fn(),
      }),
    });

    await expect(useCase.execute({
      stagingId: 'staging-123',
      tags: [],
      title: 'Fixture Video',
    })).resolves.toEqual({
      ok: false,
      message: 'Commit already in progress',
      reason: 'COMMIT_STAGED_UPLOAD_CONFLICT',
    });
  });
});
