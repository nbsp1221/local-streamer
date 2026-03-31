import type { AddVideosEncoder } from './add-videos-encoding-options';

export interface AddVideosEncodingOptionMetadata {
  value: AddVideosEncoder;
  label: string;
  description: string;
  detail: string;
  badge?: string;
}

export const ADD_VIDEOS_ENCODING_OPTION_METADATA: AddVideosEncodingOptionMetadata[] = [
  {
    value: 'cpu-h264',
    label: 'CPU H.264',
    description: 'Browser-safe default with balanced compression.',
    detail: 'Recommended for the widest playback compatibility.',
    badge: 'Recommended',
  },
  {
    value: 'gpu-h264',
    label: 'GPU H.264',
    description: 'Browser-safe encoding with faster hardware acceleration.',
    detail: 'Use when NVENC is available and shorter processing time matters.',
    badge: 'Fast',
  },
  {
    value: 'cpu-h265',
    label: 'CPU H.265',
    description: 'Smaller files with slower software encoding.',
    detail: 'Best for archival workflows that can tolerate HEVC playback limits.',
    badge: 'Archive',
  },
  {
    value: 'gpu-h265',
    label: 'GPU H.265',
    description: 'Smaller files with hardware-accelerated HEVC encoding.',
    detail: 'Use when NVENC is available and playback targets support HEVC.',
    badge: 'HEVC Fast',
  },
];
