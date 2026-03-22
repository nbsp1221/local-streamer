import { beforeEach, describe, expect, test, vi } from 'vitest';

const createMock = vi.fn();
const getVideoRepositoryMock = vi.fn(() => ({
  create: createMock,
}));

vi.mock('~/legacy/repositories', () => ({
  getVideoRepository: getVideoRepositoryMock,
}));

describe('ingest legacy video metadata writer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test('maps the canonical ingest video record into the current legacy repository create input', async () => {
    createMock.mockResolvedValue(undefined);

    const { createIngestLegacyVideoMetadataWriter } = await import('../../../app/composition/server/ingest-legacy-video-metadata-writer');
    const writer = createIngestLegacyVideoMetadataWriter();

    await writer.writeVideoRecord({
      description: 'A test video',
      duration: 120,
      id: 'video-123',
      tags: ['fixture', 'test'],
      thumbnailUrl: '/api/thumbnail/video-123',
      title: 'Fixture Video',
      videoUrl: '/videos/video-123/manifest.mpd',
    });

    expect(getVideoRepositoryMock).toHaveBeenCalledOnce();
    expect(createMock).toHaveBeenCalledWith({
      description: 'A test video',
      duration: 120,
      id: 'video-123',
      tags: ['fixture', 'test'],
      thumbnailUrl: '/api/thumbnail/video-123',
      title: 'Fixture Video',
      videoUrl: '/videos/video-123/manifest.mpd',
    });
  });
});
