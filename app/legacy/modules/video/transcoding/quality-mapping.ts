/**
 * Quality mapping strategy for video processing.
 * Maps business quality levels to technical FFmpeg parameters.
 */

export interface QualitySettings {
  // CRF/CQ value for quality control
  qualityValue: number;
  // Preset for speed/quality balance
  preset: string;
  // Additional flags for optimization
  additionalFlags: string[];
  // Description for logging/debugging
  description: string;
}

export interface EncoderQualityMap {
  cpu: QualitySettings;
  gpu: QualitySettings;
}

/**
 * Business quality levels mapped to technical parameters
 */
export const QUALITY_MAPPINGS: Record<'high' | 'medium' | 'fast', EncoderQualityMap> = {
  high: {
    cpu: {
      qualityValue: 18, // CRF 18 - visually lossless
      preset: 'slow', // Best compression efficiency
      additionalFlags: ['-tune', 'fastdecode'],
      description: 'Archival quality, best visual quality',
    },
    gpu: {
      qualityValue: 19, // CQ 19 - near lossless
      preset: 'p7', // Highest quality preset
      additionalFlags: ['-tune', 'hq', '-rc', 'vbr'],
      description: 'Archival quality, GPU accelerated',
    },
  },
  medium: {
    cpu: {
      qualityValue: 23, // CRF 23 - good balance
      preset: 'medium', // Standard preset
      additionalFlags: ['-tune', 'fastdecode'],
      description: 'Standard streaming quality, good balance',
    },
    gpu: {
      qualityValue: 23, // CQ 23 - good balance
      preset: 'p6', // Optimal quality/speed balance
      additionalFlags: ['-tune', 'hq', '-rc', 'vbr'],
      description: 'Standard streaming quality, GPU accelerated',
    },
  },
  fast: {
    cpu: {
      qualityValue: 28, // CRF 28 - acceptable quality
      preset: 'fast', // Fast processing
      additionalFlags: ['-tune', 'fastdecode'],
      description: 'Quick processing, preview quality',
    },
    gpu: {
      qualityValue: 28, // CQ 28 - acceptable quality
      preset: 'p4', // Fast preset
      additionalFlags: ['-tune', 'fastdecode', '-rc', 'cbr'],
      description: 'Quick processing, GPU accelerated',
    },
  },
} as const;

/**
 * Get FFmpeg parameters for a business quality level and processing preference
 */
export function getQualitySettings(
  quality: 'high' | 'medium' | 'fast',
  useGpu: boolean,
): QualitySettings {
  const encoderType = useGpu ? 'gpu' : 'cpu';
  return QUALITY_MAPPINGS[quality][encoderType];
}

/**
 * Get FFmpeg codec name based on processing preference
 */
export function getCodecForEncoder(useGpu: boolean): string {
  return useGpu ? 'hevc_nvenc' : 'libx265';
}

/**
 * Get quality parameter name (CRF for CPU, CQ for GPU)
 */
export function getQualityParamName(useGpu: boolean): string {
  return useGpu ? 'cq' : 'crf';
}

/**
 * Get estimated processing speed multiplier
 */
export function getEstimatedSpeedMultiplier(
  quality: 'high' | 'medium' | 'fast',
  useGpu: boolean,
): number {
  const baseSpeed = useGpu ? 30.0 : 2.0; // GPU is much faster than CPU

  const qualityMultipliers = {
    high: 0.7, // Slower for higher quality
    medium: 1.0, // Baseline
    fast: 1.5, // Faster for lower quality
  };

  return baseSpeed * qualityMultipliers[quality];
}

/**
 * Get estimated file size multiplier (relative to original)
 */
export function getEstimatedSizeMultiplier(
  quality: 'high' | 'medium' | 'fast',
): number {
  const sizeMultipliers = {
    high: 0.15, // Higher quality = larger files
    medium: 0.12, // Balanced size
    fast: 0.08, // Lower quality = smaller files
  };

  return sizeMultipliers[quality];
}

/**
 * Get user-friendly description for quality settings
 */
export function getQualityDescription(
  quality: 'high' | 'medium' | 'fast',
  useGpu: boolean,
): {
    title: string;
    description: string;
    estimatedSize: string;
    estimatedSpeed: string;
  } {
  const settings = getQualitySettings(quality, useGpu);
  const sizeMultiplier = getEstimatedSizeMultiplier(quality);
  const speedMultiplier = getEstimatedSpeedMultiplier(quality, useGpu);

  const titles = {
    high: useGpu ? 'High Quality (GPU)' : 'High Quality (CPU)',
    medium: useGpu ? 'Standard Quality (GPU)' : 'Standard Quality (CPU)',
    fast: useGpu ? 'Fast Processing (GPU)' : 'Fast Processing (CPU)',
  };

  return {
    title: titles[quality],
    description: settings.description,
    estimatedSize: `~${Math.round(sizeMultiplier * 100)}% of original`,
    estimatedSpeed: `~${speedMultiplier.toFixed(1)}x real-time`,
  };
}
