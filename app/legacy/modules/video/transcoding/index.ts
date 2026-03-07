/**
 * Public API for the transcoding module.
 * This module provides video transcoding capabilities following the port-adapter pattern.
 */

// Concrete implementations
export { FFmpegVideoTranscoderAdapter } from './FFmpegVideoTranscoderAdapter';

// Quality mapping utilities
export type {
  EncoderQualityMap,
  QualitySettings,
} from './quality-mapping';

export { QUALITY_MAPPINGS } from './quality-mapping';
// Core interfaces and types
export type {
  TranscodeRequest,
  TranscodeResult,
  VideoMetadata,
  VideoTranscoder,
} from './VideoTranscoder';
