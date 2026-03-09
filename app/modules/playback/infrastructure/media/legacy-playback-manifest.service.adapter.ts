import { getManifestUseCase } from '~/legacy/modules/video/manifest/get-manifest.usecase';
import type { PlaybackManifestService } from '../../application/ports/playback-manifest-service.port';

interface LegacyManifestUseCaseResult {
  data?: {
    headers: Record<string, string>;
    manifestContent: string;
  };
  error?: Error;
  success: boolean;
}

interface LegacyPlaybackManifestServiceAdapterDependencies {
  execute?: (input: { videoId: string }) => Promise<LegacyManifestUseCaseResult>;
}

export class LegacyPlaybackManifestServiceAdapter implements PlaybackManifestService {
  private readonly execute: (input: { videoId: string }) => Promise<LegacyManifestUseCaseResult>;

  constructor(deps: LegacyPlaybackManifestServiceAdapterDependencies = {}) {
    this.execute = deps.execute ?? (input => getManifestUseCase.execute(input));
  }

  async getManifest(input: { videoId: string }) {
    const result = await this.execute({
      videoId: input.videoId,
    });

    if (!result.success || !result.data) {
      throw result.error ?? new Error('Failed to load playback manifest');
    }

    return {
      body: result.data.manifestContent,
      headers: result.data.headers,
    };
  }
}
