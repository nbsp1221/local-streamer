import { describe, expect, it } from 'vitest';
import { EncodingValidationServiceImpl } from './EncodingValidationService';

describe('EncodingValidationService', () => {
  const service = new EncodingValidationServiceImpl();

  it('treats H.264 legacy encoders as valid and recommends the GPU H.264 variant for speed', () => {
    const result = service.validateEncodingOptions({ encoder: 'cpu-h264' });

    expect(result.valid).toBe(true);
    expect(result.warnings).toContainEqual(expect.objectContaining({
      field: 'encoder',
      suggested: 'gpu-h264',
    }));
  });
});
