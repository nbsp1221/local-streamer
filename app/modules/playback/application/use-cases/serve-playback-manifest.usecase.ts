import type { PlaybackManifestService } from '../ports/playback-manifest-service.port';
import type { PlaybackTokenService } from '../ports/playback-token-service.port';
import {
  type PlaybackResourceDecision,
  PlaybackResourcePolicy,
} from '../../domain/policies/PlaybackResourcePolicy';

interface ServePlaybackManifestUseCaseDependencies {
  manifestService: PlaybackManifestService;
  tokenService: PlaybackTokenService;
}

interface ServePlaybackManifestUseCaseInput {
  token: string | null;
  videoId: string;
}

type ServePlaybackManifestUseCaseResult =
  | {
    body: string;
    headers: Record<string, string>;
    ok: true;
  }
  | ({
    ok: false;
  } & Omit<Extract<PlaybackResourceDecision, { allowed: false }>, 'allowed'>);

export class ServePlaybackManifestUseCase {
  constructor(private readonly deps: ServePlaybackManifestUseCaseDependencies) {}

  async execute(input: ServePlaybackManifestUseCaseInput): Promise<ServePlaybackManifestUseCaseResult> {
    const payload = input.token
      ? await this.deps.tokenService.validate(input.token)
      : null;
    const decision = PlaybackResourcePolicy.evaluate({
      requestedVideoId: input.videoId,
      resource: 'manifest',
      token: payload,
    });

    if (!decision.allowed) {
      return {
        metadata: decision.metadata,
        ok: false,
        reason: decision.reason,
      };
    }

    const manifest = await this.deps.manifestService.getManifest({
      videoId: input.videoId,
    });

    return {
      body: manifest.body,
      headers: manifest.headers,
      ok: true,
    };
  }
}
