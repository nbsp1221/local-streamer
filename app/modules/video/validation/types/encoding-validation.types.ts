/**
 * Types for encoding validation service
 */

import type { EncodingOptions, EnhancedEncodingOptions } from '~/modules/video/add-video/add-video.types';

export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors if any */
  errors: ValidationError[];
  /** Validation warnings if any */
  warnings: ValidationWarning[];
  /** Sanitized options if validation passed */
  sanitizedOptions?: EncodingOptions | EnhancedEncodingOptions;
}

export interface ValidationError {
  /** Field that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Expected value or range */
  expected?: string;
  /** Actual value provided */
  actual?: string | number;
}

export interface ValidationWarning {
  /** Field that triggered warning */
  field: string;
  /** Warning message */
  message: string;
  /** Suggested value */
  suggested?: string | number;
}

export interface SegmentValidationResult {
  /** Whether the segment name is valid */
  valid: boolean;
  /** Segment type if valid */
  segmentType?: 'init' | 'media';
  /** Stream type if valid */
  streamType?: 'video' | 'audio';
  /** Segment number if applicable */
  segmentNumber?: number;
}

export interface CodecSupport {
  /** Codec name */
  codec: string;
  /** Whether codec is supported */
  supported: boolean;
  /** Whether hardware acceleration is available */
  hardwareAcceleration?: boolean;
  /** Supported presets */
  presets?: string[];
  /** Quality parameter name */
  qualityParam?: string;
  /** Valid quality range */
  qualityRange?: { min: number; max: number };
}

export interface EncodingValidationService {
  /**
   * Validate encoding options
   */
  validateEncodingOptions(options: EncodingOptions | EnhancedEncodingOptions): ValidationResult;

  /**
   * Validate segment duration
   */
  validateSegmentDuration(duration: string | number): string;

  /**
   * Validate codec
   */
  validateCodec(codec: string): ValidationResult;

  /**
   * Validate preset for a specific encoder
   */
  validatePreset(preset: string, encoder: string): ValidationResult;

  /**
   * Validate quality parameter
   */
  validateQualityParam(param: string): ValidationResult;

  /**
   * Validate quality value
   */
  validateQualityValue(value: number, param: string): ValidationResult;

  /**
   * Validate additional FFmpeg flags
   */
  validateAdditionalFlags(flags: string[]): ValidationResult;

  /**
   * Check if a segment name is valid for DASH/HLS
   */
  isValidSegmentName(filename: string): SegmentValidationResult;

  /**
   * Get supported codecs
   */
  getSupportedCodecs(): CodecSupport[];

  /**
   * Check if a codec is supported
   */
  isCodecSupported(codec: string): boolean;

  /**
   * Sanitize and normalize encoding options
   */
  sanitizeEncodingOptions(options: EncodingOptions | EnhancedEncodingOptions): EncodingOptions | EnhancedEncodingOptions;
}
