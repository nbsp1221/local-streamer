import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';

/**
 * Default encoding options - CPU H.265 for best quality
 */
export const DEFAULT_ENCODING_OPTIONS: EncodingOptions = {
  encoder: 'cpu-h265',
};

/**
 * Optimal encoding settings for each encoder type
 */
export const OPTIMAL_ENCODING_SETTINGS = {
  'cpu-h265': {
    codec: 'libx265',
    quality: 18,        // CRF value - visually lossless quality
    preset: 'slow',     // Best compression efficiency for CPU
    qualityParam: 'crf',
    additionalFlags: ['-tune', 'fastdecode'], // Optimize for streaming playback
  },
  'gpu-h265': {
    codec: 'hevc_nvenc',
    quality: 19,        // CQ value - near lossless quality
    preset: 'p6',       // Optimal quality/speed balance for GPU
    qualityParam: 'cq',
    additionalFlags: ['-tune', 'hq', '-rc', 'vbr'], // High quality tuning + variable bitrate
  },
} as const;

/**
 * Supported encoder types
 */
export const SUPPORTED_ENCODERS = ['cpu-h265', 'gpu-h265'] as const;

/**
 * Validate encoder type at runtime
 */
export function isValidEncoder(encoder: string): encoder is EncodingOptions['encoder'] {
  return SUPPORTED_ENCODERS.includes(encoder as EncodingOptions['encoder']);
}

/**
 * Get optimal settings for an encoder with runtime validation
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
 * Get codec name for FFmpeg
 */
export function getCodecName(encoder: EncodingOptions['encoder']): string {
  return getOptimalSettings(encoder).codec;
}

/**
 * Get quality parameter name (CRF for CPU, CQ for GPU)
 */
export function getQualityParam(encoder: EncodingOptions['encoder']): string {
  return getOptimalSettings(encoder).qualityParam;
}

/**
 * Get quality value for encoder
 */
export function getQualityValue(encoder: EncodingOptions['encoder']): number {
  return getOptimalSettings(encoder).quality;
}

/**
 * Get preset value for encoder
 */
export function getPresetValue(encoder: EncodingOptions['encoder']): string {
  return getOptimalSettings(encoder).preset;
}

/**
 * Get additional encoding flags for optimal quality
 */
export function getAdditionalFlags(encoder: EncodingOptions['encoder']): string[] {
  return [...getOptimalSettings(encoder).additionalFlags];
}

/**
 * Get estimated file size multiplier based on encoder
 */
export function getEstimatedSizeMultiplier(encoder: EncodingOptions['encoder']): number {
  // Base multipliers by encoder type (relative to original)
  // Using the optimal settings for each encoder with higher quality (CRF 18/CQ 19)
  const multipliers = {
    'cpu-h265': 0.12,   // Higher quality (CRF 18) = larger files but excellent compression
    'gpu-h265': 0.20,   // Higher quality (CQ 19) = larger files with p6 preset
  };
  
  return multipliers[encoder];
}

/**
 * Get estimated encoding speed multiplier (relative to real-time)
 */
export function getEstimatedSpeedMultiplier(encoder: EncodingOptions['encoder']): number {
  // Speed estimates based on optimal settings
  const speeds = {
    'cpu-h265': 1.8,    // Slower with 'slow' preset but better quality
    'gpu-h265': 30.0,   // Very fast with p6 preset
  };
  
  return speeds[encoder];
}

/**
 * Get user-friendly description for encoding options
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
    'cpu-h265': {
      title: 'CPU H.265',
      description: 'Visually Lossless • Slower Encoding',
    },
    'gpu-h265': {
      title: 'GPU H.265', 
      description: 'Near Lossless • Fast Encoding',
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
 * Validate encoding options with detailed error reporting
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
 * Validate encoding options and throw descriptive errors
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
 * Get default options for a specific encoder with validation
 */
export function getDefaultOptionsForEncoder(encoder: EncodingOptions['encoder']): EncodingOptions {
  if (!isValidEncoder(encoder)) {
    throw new Error(`Invalid encoder type: ${encoder}. Supported encoders: ${SUPPORTED_ENCODERS.join(', ')}`);
  }
  return { encoder };
}