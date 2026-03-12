import type { EncodingOptions } from '~/legacy/modules/video/add-video/add-video.types';

/**
 * Default encoding options - CPU H.264 for broad browser playback compatibility.
 */
export const DEFAULT_ENCODING_OPTIONS: EncodingOptions = {
  encoder: 'cpu-h264',
};

/**
 * Optimal encoding settings for each encoder type.
 */
export const OPTIMAL_ENCODING_SETTINGS = {
  'cpu-h264': {
    codec: 'libx264',
    quality: 20,
    preset: 'slow',
    qualityParam: 'crf',
    additionalFlags: ['-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p'],
  },
  'gpu-h264': {
    codec: 'h264_nvenc',
    quality: 21,
    preset: 'p6',
    qualityParam: 'cq',
    additionalFlags: ['-profile:v', 'high', '-pix_fmt', 'yuv420p', '-rc', 'vbr'],
  },
  'cpu-h265': {
    codec: 'libx265',
    quality: 18,
    preset: 'slow',
    qualityParam: 'crf',
    additionalFlags: ['-tune', 'fastdecode'],
  },
  'gpu-h265': {
    codec: 'hevc_nvenc',
    quality: 19,
    preset: 'p6',
    qualityParam: 'cq',
    additionalFlags: ['-tune', 'hq', '-rc', 'vbr'],
  },
} as const;

/**
 * Supported encoder types.
 */
export const SUPPORTED_ENCODERS = ['cpu-h264', 'gpu-h264', 'cpu-h265', 'gpu-h265'] as const;

/**
 * Validate encoder type at runtime.
 */
export function isValidEncoder(encoder: string): encoder is EncodingOptions['encoder'] {
  return SUPPORTED_ENCODERS.includes(encoder as EncodingOptions['encoder']);
}

/**
 * Get optimal settings for an encoder with runtime validation.
 */
export function getOptimalSettings(encoder: EncodingOptions['encoder']) {
  if (!isValidEncoder(encoder)) {
    throw new Error(`Invalid encoder type: ${encoder}. Supported encoders: ${SUPPORTED_ENCODERS.join(', ')}`);
  }

  const settings = OPTIMAL_ENCODING_SETTINGS[encoder];
  if (!settings) {
    throw new Error(`No optimal settings found for encoder: ${encoder}`);
  }

  return settings;
}

/**
 * Get codec name for FFmpeg.
 */
export function getCodecName(encoder: EncodingOptions['encoder']): string {
  return getOptimalSettings(encoder).codec;
}

/**
 * Get quality parameter name (CRF for CPU, CQ for GPU).
 */
export function getQualityParam(encoder: EncodingOptions['encoder']): string {
  return getOptimalSettings(encoder).qualityParam;
}

/**
 * Get quality value for encoder.
 */
export function getQualityValue(encoder: EncodingOptions['encoder']): number {
  return getOptimalSettings(encoder).quality;
}

/**
 * Get preset value for encoder.
 */
export function getPresetValue(encoder: EncodingOptions['encoder']): string {
  return getOptimalSettings(encoder).preset;
}

/**
 * Get additional encoding flags for optimal quality.
 */
export function getAdditionalFlags(encoder: EncodingOptions['encoder']): string[] {
  return [...getOptimalSettings(encoder).additionalFlags];
}

/**
 * Get estimated file size multiplier based on encoder.
 */
export function getEstimatedSizeMultiplier(encoder: EncodingOptions['encoder']): number {
  const multipliers = {
    'cpu-h264': 0.24,
    'gpu-h264': 0.28,
    'cpu-h265': 0.12,
    'gpu-h265': 0.20,
  };

  return multipliers[encoder];
}

/**
 * Get estimated encoding speed multiplier (relative to real-time).
 */
export function getEstimatedSpeedMultiplier(encoder: EncodingOptions['encoder']): number {
  const speeds = {
    'cpu-h264': 3.2,
    'gpu-h264': 36.0,
    'cpu-h265': 1.8,
    'gpu-h265': 30.0,
  };

  return speeds[encoder];
}

/**
 * Get user-friendly description for encoding options.
 */
export function getEncodingDescription(options: EncodingOptions): {
  title: string;
  description: string;
  estimatedSize: string;
  estimatedSpeed: string;
} {
  const sizeMultiplier = getEstimatedSizeMultiplier(options.encoder);
  const speedMultiplier = getEstimatedSpeedMultiplier(options.encoder);

  const descriptions = {
    'cpu-h264': {
      title: 'CPU H.264',
      description: 'Browser-safe default • Balanced compression',
    },
    'gpu-h264': {
      title: 'GPU H.264',
      description: 'Browser-safe default • Fast encoding',
    },
    'cpu-h265': {
      title: 'CPU H.265',
      description: 'Archive option • Better compression, weaker browser compatibility',
    },
    'gpu-h265': {
      title: 'GPU H.265',
      description: 'Archive option • Fast HEVC encoding',
    },
  };

  const info = descriptions[options.encoder];

  return {
    title: info.title,
    description: info.description,
    estimatedSize: `~${Math.round(sizeMultiplier * 100)}% of original`,
    estimatedSpeed: `~${speedMultiplier.toFixed(1)}x real-time`,
  };
}

/**
 * Validate encoding options with detailed error reporting.
 */
export function validateEncodingOptions(options: EncodingOptions): boolean {
  if (!options || typeof options !== 'object') {
    return false;
  }

  if (!options.encoder || typeof options.encoder !== 'string') {
    return false;
  }

  return isValidEncoder(options.encoder);
}

/**
 * Validate encoding options and throw descriptive errors.
 */
export function validateEncodingOptionsStrict(options: EncodingOptions): void {
  if (!options || typeof options !== 'object') {
    throw new Error('Encoding options must be a valid object');
  }

  if (!options.encoder || typeof options.encoder !== 'string') {
    throw new Error('Encoder type is required and must be a string');
  }

  if (!isValidEncoder(options.encoder)) {
    throw new Error(`Invalid encoder type: ${options.encoder}. Supported encoders: ${SUPPORTED_ENCODERS.join(', ')}`);
  }
}

/**
 * Get default options for a specific encoder with validation.
 */
export function getDefaultOptionsForEncoder(encoder: EncodingOptions['encoder']): EncodingOptions {
  if (!isValidEncoder(encoder)) {
    throw new Error(`Invalid encoder type: ${encoder}. Supported encoders: ${SUPPORTED_ENCODERS.join(', ')}`);
  }
  return { encoder };
}
