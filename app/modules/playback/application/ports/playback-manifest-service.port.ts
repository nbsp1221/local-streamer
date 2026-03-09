export interface PlaybackManifestResponse {
  body: string;
  headers: Record<string, string>;
}

export interface PlaybackManifestService {
  getManifest: (input: { videoId: string }) => Promise<PlaybackManifestResponse>;
}
