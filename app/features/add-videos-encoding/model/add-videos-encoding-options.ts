export type AddVideosEncoder = 'cpu-h264' | 'gpu-h264' | 'cpu-h265' | 'gpu-h265';

export interface AddVideosEncodingOptions {
  encoder: AddVideosEncoder;
}

export const DEFAULT_ADD_VIDEOS_ENCODING_OPTIONS: AddVideosEncodingOptions = {
  encoder: 'cpu-h264',
};

export function createDefaultAddVideosEncodingOptions(): AddVideosEncodingOptions {
  return { ...DEFAULT_ADD_VIDEOS_ENCODING_OPTIONS };
}
