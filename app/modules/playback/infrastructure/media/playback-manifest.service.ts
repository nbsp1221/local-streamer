import type { PlaybackManifestService as PlaybackManifestServicePort } from '../../application/ports/playback-manifest-service.port';
import { LegacyPlaybackManifestServiceAdapter } from './legacy-playback-manifest.service.adapter';

interface PlaybackManifestUseCaseResult {
  data?: {
    headers: Record<string, string>;
    manifestContent: string;
  };
  error?: Error;
  success: boolean;
}

interface PlaybackManifestServiceDependencies {
  execute?: (input: { videoId: string }) => Promise<PlaybackManifestUseCaseResult>;
}

// Temporary playback-owned compatibility seam while manifest generation still delegates to legacy playback internals.
export class PlaybackManifestService implements PlaybackManifestServicePort {
  private readonly delegate: PlaybackManifestServicePort;

  constructor(deps: PlaybackManifestServiceDependencies = {}) {
    this.delegate = new LegacyPlaybackManifestServiceAdapter(deps);
  }

  async getManifest(input: Parameters<PlaybackManifestServicePort['getManifest']>[0]) {
    return this.delegate.getManifest(input);
  }
}
