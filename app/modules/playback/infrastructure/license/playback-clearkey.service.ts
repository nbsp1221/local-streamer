import type { PlaybackClearKeyService as PlaybackClearKeyServicePort } from '../../application/ports/playback-clearkey-service.port';
import { LegacyPlaybackClearKeyServiceAdapter } from './legacy-playback-clearkey.service.adapter';

interface PlaybackClearKeyUseCaseResult {
  data?: {
    clearKeyResponse: {
      keys: Array<{
        k: string;
        kid: string;
        kty: string;
      }>;
      type: string;
    };
    headers: Record<string, string>;
    success: true;
  };
  error?: Error;
  success: boolean;
}

interface PlaybackClearKeyServiceDependencies {
  execute?: (input: { request: Request; videoId: string }) => Promise<PlaybackClearKeyUseCaseResult>;
}

// Temporary playback-owned compatibility seam while ClearKey delivery still delegates to legacy internals.
export class PlaybackClearKeyService implements PlaybackClearKeyServicePort {
  private readonly delegate: PlaybackClearKeyServicePort;

  constructor(deps: PlaybackClearKeyServiceDependencies = {}) {
    this.delegate = new LegacyPlaybackClearKeyServiceAdapter(deps);
  }

  async serveLicense(input: Parameters<PlaybackClearKeyServicePort['serveLicense']>[0]) {
    return this.delegate.serveLicense(input);
  }
}
