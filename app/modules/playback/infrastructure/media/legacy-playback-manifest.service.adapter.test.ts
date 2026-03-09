import { describe, expect, test, vi } from 'vitest';

describe('LegacyPlaybackManifestServiceAdapter', () => {
  test('maps the legacy manifest use-case output to the playback manifest port contract', async () => {
    const { LegacyPlaybackManifestServiceAdapter } = await import('./legacy-playback-manifest.service.adapter');
    const execute = vi.fn(async () => ({
      data: {
        headers: {
          'Content-Length': '7',
          'Content-Type': 'application/dash+xml',
        },
        manifestContent: '<MPD />',
      },
      success: true,
    }));
    const adapter = new LegacyPlaybackManifestServiceAdapter({
      execute,
    });

    const result = await adapter.getManifest({
      videoId: 'video-1',
    });

    expect(result).toEqual({
      body: '<MPD />',
      headers: {
        'Content-Length': '7',
        'Content-Type': 'application/dash+xml',
      },
    });
    expect(execute).toHaveBeenCalledWith({
      videoId: 'video-1',
    });
  });
});
