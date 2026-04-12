import { beforeEach, describe, expect, test, vi } from 'vitest';

const migrateExistingThumbnailMock = vi.fn();

vi.mock('~/legacy/modules/thumbnail/shared/thumbnail-generator-encrypted.server', () => ({
  encryptedThumbnailGenerator: {
    migrateExistingThumbnail: migrateExistingThumbnailMock,
  },
}));

describe('LegacyThumbnailFinalizerAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  test('finalizes the thumbnail by migrating the existing thumbnail after successful ingest', async () => {
    migrateExistingThumbnailMock.mockResolvedValue({
      success: true,
    });

    const logger = {
      error: vi.fn(),
      info: vi.fn(),
    };
    const { LegacyThumbnailFinalizerAdapter } = await import('../../../app/modules/thumbnail/infrastructure/finalization/legacy-thumbnail-finalizer.adapter');
    const finalizer = new LegacyThumbnailFinalizerAdapter({
      logger,
    });

    await expect(finalizer.finalizeThumbnail({
      title: 'Fixture Video',
      videoId: 'video-123',
    })).resolves.toBeUndefined();

    expect(migrateExistingThumbnailMock).toHaveBeenCalledWith('video-123');
    expect(logger.info).toHaveBeenCalledWith('✅ Thumbnail encrypted for: Fixture Video (video-123)');
    expect(logger.error).not.toHaveBeenCalled();
  });

  test('swallows a failed thumbnail migration and logs the error', async () => {
    migrateExistingThumbnailMock.mockResolvedValue({
      error: new Error('migration failed'),
      success: false,
    });

    const logger = {
      error: vi.fn(),
      info: vi.fn(),
    };
    const { LegacyThumbnailFinalizerAdapter } = await import('../../../app/modules/thumbnail/infrastructure/finalization/legacy-thumbnail-finalizer.adapter');
    const finalizer = new LegacyThumbnailFinalizerAdapter({
      logger,
    });

    await expect(finalizer.finalizeThumbnail({
      title: 'Fixture Video',
      videoId: 'video-123',
    })).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      '❌ Failed to encrypt thumbnail for video-123:',
      expect.any(Error),
    );
  });

  test('swallows thrown migration errors and logs them', async () => {
    migrateExistingThumbnailMock.mockRejectedValue(new Error('boom'));

    const logger = {
      error: vi.fn(),
      info: vi.fn(),
    };
    const { LegacyThumbnailFinalizerAdapter } = await import('../../../app/modules/thumbnail/infrastructure/finalization/legacy-thumbnail-finalizer.adapter');
    const finalizer = new LegacyThumbnailFinalizerAdapter({
      logger,
    });

    await expect(finalizer.finalizeThumbnail({
      title: 'Fixture Video',
      videoId: 'video-123',
    })).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      '❌ Failed to encrypt thumbnail for video-123:',
      expect.any(Error),
    );
  });
});
