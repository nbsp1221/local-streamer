export interface PlaybackClearKeyResponse {
  body: string;
  headers: Record<string, string>;
}

export interface PlaybackClearKeyService {
  serveLicense: (input: { videoId: string }) => Promise<PlaybackClearKeyResponse>;
}
