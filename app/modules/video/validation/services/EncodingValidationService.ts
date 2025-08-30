import type { EncodingOptions, EnhancedEncodingOptions } from '~/modules/video/add-video/add-video.types';
import { validateEncodingOptionsStrict } from '~/utils/encoding';
import type {
  CodecSupport,
  EncodingValidationService,
  SegmentValidationResult,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from '../types/encoding-validation.types';

/**
 * Service responsible for validating encoding parameters
 */
export class EncodingValidationServiceImpl implements EncodingValidationService {
  private readonly supportedCodecs: CodecSupport[] = [
    {
      codec: 'libx264',
      supported: true,
      hardwareAcceleration: false,
      presets: ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'],
      qualityParam: 'crf',
      qualityRange: { min: 0, max: 51 },
    },
    {
      codec: 'libx265',
      supported: true,
      hardwareAcceleration: false,
      presets: ['ultrafast', 'superfast', 'veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow', 'placebo'],
      qualityParam: 'crf',
      qualityRange: { min: 0, max: 51 },
    },
    {
      codec: 'hevc_nvenc',
      supported: true,
      hardwareAcceleration: true,
      presets: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
      qualityParam: 'cq',
      qualityRange: { min: 0, max: 51 },
    },
    {
      codec: 'h264_nvenc',
      supported: true,
      hardwareAcceleration: true,
      presets: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
      qualityParam: 'cq',
      qualityRange: { min: 0, max: 51 },
    },
    {
      codec: 'h264_vaapi',
      supported: true,
      hardwareAcceleration: true,
      presets: [],
      qualityParam: 'qp',
      qualityRange: { min: 0, max: 51 },
    },
    {
      codec: 'hevc_vaapi',
      supported: true,
      hardwareAcceleration: true,
      presets: [],
      qualityParam: 'qp',
      qualityRange: { min: 0, max: 51 },
    },
  ];

  /**
   * Validate encoding options
   */
  validateEncodingOptions(options: EncodingOptions | EnhancedEncodingOptions): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check if it's enhanced options
    if ('codec' in options) {
      return this.validateEnhancedOptions(options as EnhancedEncodingOptions);
    }

    // Validate legacy options
    const legacyOptions = options as EncodingOptions;

    // Validate encoder
    if (!this.isValidEncoder(legacyOptions.encoder)) {
      errors.push({
        field: 'encoder',
        message: `Invalid encoder: ${legacyOptions.encoder}`,
        expected: 'cpu-h264, cpu-h265, gpu-h264, gpu-h265',
        actual: legacyOptions.encoder,
      });
    }

    // Note: Legacy EncodingOptions only has 'encoder' property
    // Quality and preset are automatically determined by the service

    // Add warnings for CPU encoding (legacy options don't specify quality/preset)
    if (legacyOptions.encoder.startsWith('cpu-')) {
      warnings.push({
        field: 'encoder',
        message: 'CPU encoding may be slower than GPU encoding',
        suggested: 'gpu-h265',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedOptions: errors.length === 0 ? this.sanitizeEncodingOptions(options) : undefined,
    };
  }

  /**
   * Validate enhanced encoding options
   */
  private validateEnhancedOptions(options: EnhancedEncodingOptions): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Enhanced options have their own validation logic below

    // Validate codec
    const codecResult = this.validateCodec(options.codec);
    if (!codecResult.valid) {
      errors.push(...codecResult.errors);
    }

    // Validate quality value
    if (options.qualityValue !== undefined) {
      const qualityResult = this.validateQualityValue(options.qualityValue, options.qualityParam);
      if (!qualityResult.valid) {
        errors.push(...qualityResult.errors);
      }
    }

    // Validate preset
    if (options.preset) {
      const presetResult = this.validatePreset(options.preset, options.codec);
      if (!presetResult.valid) {
        errors.push(...presetResult.errors);
      }
    }

    // Validate additional flags
    if (options.additionalFlags) {
      const flagsResult = this.validateAdditionalFlags(options.additionalFlags);
      if (!flagsResult.valid) {
        errors.push(...flagsResult.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedOptions: errors.length === 0 ? this.sanitizeEncodingOptions(options) : undefined,
    };
  }

  /**
   * Validate segment duration
   */
  validateSegmentDuration(duration: string | number): string {
    const numericDuration = typeof duration === 'string' ? parseInt(duration, 10) : duration;

    if (isNaN(numericDuration) || numericDuration < 1 || numericDuration > 60) {
      console.warn(`⚠️ [Validation] Invalid segment duration: ${duration}, using default: 10`);
      return '10';
    }

    return numericDuration.toString();
  }

  /**
   * Validate codec
   */
  validateCodec(codec: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!this.isCodecSupported(codec)) {
      errors.push({
        field: 'codec',
        message: `Unsupported codec: ${codec}`,
        expected: this.supportedCodecs.map(c => c.codec).join(', '),
        actual: codec,
      });
    }

    // Check for hardware codec availability warnings
    const codecInfo = this.supportedCodecs.find(c => c.codec === codec);
    if (codecInfo?.hardwareAcceleration) {
      warnings.push({
        field: 'codec',
        message: `Hardware codec ${codec} requires GPU support`,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate preset for a specific encoder
   */
  validatePreset(preset: string, encoder: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Map encoder to codec if needed
    const codec = this.getCodecFromEncoder(encoder);
    const codecInfo = this.supportedCodecs.find(c => c.codec === codec);

    if (!codecInfo) {
      errors.push({
        field: 'encoder',
        message: `Unknown encoder: ${encoder}`,
        actual: encoder,
      });
      return { valid: false, errors, warnings };
    }

    if (codecInfo.presets && codecInfo.presets.length > 0) {
      if (!codecInfo.presets.includes(preset)) {
        errors.push({
          field: 'preset',
          message: `Invalid preset for ${codec}: ${preset}`,
          expected: codecInfo.presets.join(', '),
          actual: preset,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate quality parameter
   */
  validateQualityParam(param: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const validParams = ['crf', 'cq', 'qp', 'qmin', 'qmax'];

    if (!validParams.includes(param)) {
      errors.push({
        field: 'qualityParam',
        message: `Invalid quality parameter: ${param}`,
        expected: validParams.join(', '),
        actual: param,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate quality value
   */
  validateQualityValue(value: number, param: string): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (value < 0 || value > 51) {
      errors.push({
        field: 'qualityValue',
        message: `Quality value out of range: ${value}`,
        expected: '0-51',
        actual: value,
      });
    }

    // Add warnings for extreme values
    if (value < 10) {
      warnings.push({
        field: 'qualityValue',
        message: 'Very low quality value may result in unnecessarily large files',
        suggested: 18,
      });
    }
    else if (value > 35) {
      warnings.push({
        field: 'qualityValue',
        message: 'High quality value may result in poor visual quality',
        suggested: 23,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate additional FFmpeg flags
   */
  validateAdditionalFlags(flags: string[]): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const dangerousFlags = ['-i', '-o', '-y', '-n', '-f'];

    for (const flag of flags) {
      if (dangerousFlags.includes(flag)) {
        errors.push({
          field: 'additionalFlags',
          message: `Potentially dangerous flag: ${flag}`,
          actual: flag,
        });
      }
    }

    // Warn about too many flags
    if (flags.length > 10) {
      warnings.push({
        field: 'additionalFlags',
        message: 'Large number of additional flags may cause unexpected behavior',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if a segment name is valid for DASH/HLS
   */
  isValidSegmentName(filename: string): SegmentValidationResult {
    // Check for init segments
    if (filename === 'init.mp4') {
      return { valid: true, segmentType: 'init', streamType: undefined };
    }

    // Check for media segments (e.g., segment-0001.m4s)
    const segmentMatch = filename.match(/^segment-(\d+)\.m4s$/);
    if (segmentMatch) {
      return {
        valid: true,
        segmentType: 'media',
        streamType: undefined,
        segmentNumber: parseInt(segmentMatch[1], 10),
      };
    }

    // Check for stream-specific segments (e.g., video/segment-0001.m4s)
    const streamSegmentMatch = filename.match(/^(video|audio)\/segment-(\d+)\.m4s$/);
    if (streamSegmentMatch) {
      return {
        valid: true,
        segmentType: 'media',
        streamType: streamSegmentMatch[1] as 'video' | 'audio',
        segmentNumber: parseInt(streamSegmentMatch[2], 10),
      };
    }

    // Check for stream-specific init segments
    const streamInitMatch = filename.match(/^(video|audio)\/init\.mp4$/);
    if (streamInitMatch) {
      return {
        valid: true,
        segmentType: 'init',
        streamType: streamInitMatch[1] as 'video' | 'audio',
      };
    }

    return { valid: false };
  }

  /**
   * Get supported codecs
   */
  getSupportedCodecs(): CodecSupport[] {
    return [...this.supportedCodecs];
  }

  /**
   * Check if a codec is supported
   */
  isCodecSupported(codec: string): boolean {
    return this.supportedCodecs.some(c => c.codec === codec);
  }

  /**
   * Sanitize and normalize encoding options
   */
  sanitizeEncodingOptions(options: EncodingOptions | EnhancedEncodingOptions): EncodingOptions | EnhancedEncodingOptions {
    if ('codec' in options) {
      // Sanitize enhanced options
      const enhanced = options as EnhancedEncodingOptions;
      return {
        ...enhanced,
        codec: enhanced.codec.toLowerCase(),
        preset: enhanced.preset?.toLowerCase(),
        qualityParam: enhanced.qualityParam.toLowerCase(),
        qualityValue: Math.max(0, Math.min(51, enhanced.qualityValue)),
        additionalFlags: enhanced.additionalFlags?.filter(f => f.trim().length > 0),
      };
    }
    else {
      // Sanitize legacy options (only has encoder property)
      const legacy = options as EncodingOptions;
      return {
        ...legacy,
        encoder: legacy.encoder.toLowerCase() as any,
      };
    }
  }

  /**
   * Helper: Check if encoder is valid
   */
  private isValidEncoder(encoder: string): boolean {
    const validEncoders = ['cpu-h264', 'cpu-h265', 'gpu-h264', 'gpu-h265'];
    return validEncoders.includes(encoder.toLowerCase());
  }

  /**
   * Helper: Check if quality is valid
   */
  private isValidQuality(quality: string): boolean {
    const validQualities = ['low', 'medium', 'high'];
    return validQualities.includes(quality.toLowerCase());
  }

  /**
   * Helper: Check if preset is valid
   */
  private isValidPreset(preset: string): boolean {
    const validPresets = ['slow', 'medium', 'fast'];
    return validPresets.includes(preset.toLowerCase());
  }

  /**
   * Helper: Map encoder to codec
   */
  private getCodecFromEncoder(encoder: string): string {
    const mapping: Record<string, string> = {
      'cpu-h264': 'libx264',
      'cpu-h265': 'libx265',
      'gpu-h264': 'h264_nvenc',
      'gpu-h265': 'hevc_nvenc',
    };

    // If already a codec name, return as is
    if (this.isCodecSupported(encoder)) {
      return encoder;
    }

    return mapping[encoder.toLowerCase()] || encoder;
  }
}

// Export singleton instance
export const encodingValidationService = new EncodingValidationServiceImpl();
