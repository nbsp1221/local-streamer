import { describe, expect, test } from 'vitest';

describe('resolveIngestProcessingEncodingPolicy', () => {
  test('defaults to CPU H.264 high quality when encoding options are omitted', async () => {
    const { resolveIngestProcessingEncodingPolicy } = await import('../../../../app/modules/ingest/infrastructure/processing/ingest-processing-encoding-policy');

    expect(resolveIngestProcessingEncodingPolicy()).toEqual({
      codecFamily: 'h264',
      quality: 'high',
      useGpu: false,
    });
  });

  test('maps each supported ingest encoder to the current processing policy', async () => {
    const { resolveIngestProcessingEncodingPolicy } = await import('../../../../app/modules/ingest/infrastructure/processing/ingest-processing-encoding-policy');

    expect(resolveIngestProcessingEncodingPolicy({ encoder: 'cpu-h264' })).toEqual({
      codecFamily: 'h264',
      quality: 'high',
      useGpu: false,
    });
    expect(resolveIngestProcessingEncodingPolicy({ encoder: 'gpu-h264' })).toEqual({
      codecFamily: 'h264',
      quality: 'high',
      useGpu: true,
    });
    expect(resolveIngestProcessingEncodingPolicy({ encoder: 'cpu-h265' })).toEqual({
      codecFamily: 'h265',
      quality: 'high',
      useGpu: false,
    });
    expect(resolveIngestProcessingEncodingPolicy({ encoder: 'gpu-h265' })).toEqual({
      codecFamily: 'h265',
      quality: 'high',
      useGpu: true,
    });
  });
});
