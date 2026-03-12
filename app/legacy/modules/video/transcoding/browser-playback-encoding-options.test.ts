import { describe, expect, it } from 'vitest';
import { createBrowserPlaybackEncodingOptions } from './browser-playback-encoding-options';

describe('createBrowserPlaybackEncodingOptions', () => {
  it('materializes the browser-safe CPU H.264 FFmpeg profile from the documented defaults', () => {
    const options = createBrowserPlaybackEncodingOptions({
      encoder: 'cpu-h264',
      targetVideoBitrate: 4200,
    });

    expect(options).toMatchObject({
      codec: 'libx264',
      preset: 'slow',
      qualityParam: 'crf',
      qualityValue: 20,
      targetVideoBitrate: 4200,
    });
    expect(options.additionalFlags).toEqual(expect.arrayContaining([
      '-profile:v',
      'high',
      '-level',
      '4.1',
      '-pix_fmt',
      'yuv420p',
    ]));
  });
});
