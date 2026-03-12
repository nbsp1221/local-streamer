import { describe, expect, it } from 'vitest';
import { getCodecForEncoder, getQualityParamName } from './quality-mapping';

describe('quality-mapping', () => {
  it('uses H.264 codecs for the browser-safe playback path by default', () => {
    expect(getCodecForEncoder(false)).toBe('libx264');
    expect(getCodecForEncoder(true)).toBe('h264_nvenc');
    expect(getQualityParamName(false)).toBe('crf');
    expect(getQualityParamName(true)).toBe('cq');
  });

  it('still allows explicit H.265 opt-in mappings', () => {
    expect(getCodecForEncoder(false, 'h265')).toBe('libx265');
    expect(getCodecForEncoder(true, 'h265')).toBe('hevc_nvenc');
  });
});
