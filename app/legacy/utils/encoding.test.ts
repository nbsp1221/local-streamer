import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ENCODING_OPTIONS,
  SUPPORTED_ENCODERS,
  getCodecName,
  getDefaultOptionsForEncoder,
  getEncodingDescription,
} from './encoding';

describe('encoding defaults', () => {
  it('uses CPU H.264 as the browser-safe default encoder', () => {
    expect(DEFAULT_ENCODING_OPTIONS).toEqual({ encoder: 'cpu-h264' });
  });

  it('supports both H.264 and H.265 encoder variants', () => {
    expect(SUPPORTED_ENCODERS).toEqual(['cpu-h264', 'gpu-h264', 'cpu-h265', 'gpu-h265']);
  });

  it('maps GPU H.264 to the NVENC AVC codec and returns browser-safe labels', () => {
    expect(getCodecName('gpu-h264')).toBe('h264_nvenc');
    expect(getDefaultOptionsForEncoder('cpu-h264')).toEqual({ encoder: 'cpu-h264' });
    expect(getEncodingDescription({ encoder: 'cpu-h264' })).toMatchObject({
      title: 'CPU H.264',
    });
  });
});
