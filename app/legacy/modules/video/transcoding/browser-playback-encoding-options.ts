import type { EnhancedEncodingOptions, EncodingOptions } from '../add-video/add-video.types';
import {
  getAdditionalFlags,
  getCodecName,
  getPresetValue,
  getQualityParam,
  getQualityValue,
} from '~/legacy/utils/encoding';

interface CreateBrowserPlaybackEncodingOptionsInput {
  audioSettings?: {
    bitrate: string;
    codec: string;
  };
  encoder: EncodingOptions['encoder'];
  targetVideoBitrate: number;
}

export function createBrowserPlaybackEncodingOptions(
  input: CreateBrowserPlaybackEncodingOptionsInput,
): EnhancedEncodingOptions {
  return {
    additionalFlags: getAdditionalFlags(input.encoder),
    audioSettings: input.audioSettings ?? {
      bitrate: '128k',
      codec: 'aac',
    },
    codec: getCodecName(input.encoder),
    preset: getPresetValue(input.encoder),
    qualityParam: getQualityParam(input.encoder),
    qualityValue: getQualityValue(input.encoder),
    targetVideoBitrate: input.targetVideoBitrate,
  };
}

export function resolveEncodingPreset(
  codecFamily: 'h264' | 'h265',
  useGpu: boolean,
): EncodingOptions['encoder'] {
  return `${useGpu ? 'gpu' : 'cpu'}-${codecFamily}` as EncodingOptions['encoder'];
}
