import type { IngestEncodingOptions } from '../../application/ports/ingest-library-intake.port';

export interface IngestProcessingEncodingPolicy {
  codecFamily: 'h264' | 'h265';
  quality: 'high' | 'medium' | 'fast';
  useGpu: boolean;
}

export function resolveIngestProcessingEncodingPolicy(
  encodingOptions?: IngestEncodingOptions,
): IngestProcessingEncodingPolicy {
  if (!encodingOptions) {
    return {
      codecFamily: 'h264',
      quality: 'high',
      useGpu: false,
    };
  }

  return {
    codecFamily: encodingOptions.encoder.endsWith('h265') ? 'h265' : 'h264',
    quality: 'high',
    useGpu: encodingOptions.encoder.startsWith('gpu-'),
  };
}
