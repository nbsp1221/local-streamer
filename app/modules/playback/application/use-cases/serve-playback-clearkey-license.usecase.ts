import type { PlaybackClearKeyService } from '../ports/playback-clearkey-service.port';
import type { PlaybackTokenService } from '../ports/playback-token-service.port';
import {
  type PlaybackResourceDecision,
  PlaybackResourcePolicy,
} from '../../domain/policies/PlaybackResourcePolicy';

interface ServePlaybackClearKeyLicenseUseCaseDependencies {
  clearKeyService: PlaybackClearKeyService;
  tokenService: PlaybackTokenService;
}

interface ServePlaybackClearKeyLicenseUseCaseInput {
  token: string | null;
  videoId: string;
}

type ServePlaybackClearKeyLicenseUseCaseResult =
  | {
    body: string;
    headers: Record<string, string>;
    ok: true;
  }
  | ({
    ok: false;
  } & Omit<Extract<PlaybackResourceDecision, { allowed: false }>, 'allowed'>);

export class ServePlaybackClearKeyLicenseUseCase {
  constructor(private readonly deps: ServePlaybackClearKeyLicenseUseCaseDependencies) {}

  async execute(input: ServePlaybackClearKeyLicenseUseCaseInput): Promise<ServePlaybackClearKeyLicenseUseCaseResult> {
    const payload = input.token
      ? await this.deps.tokenService.validate(input.token)
      : null;
    const decision = PlaybackResourcePolicy.evaluate({
      requestedVideoId: input.videoId,
      resource: 'clearkey-license',
      token: payload,
    });

    if (!decision.allowed) {
      return {
        metadata: decision.metadata,
        ok: false,
        reason: decision.reason,
      };
    }

    const license = await this.deps.clearKeyService.serveLicense({
      videoId: input.videoId,
    });

    return {
      body: license.body,
      headers: license.headers,
      ok: true,
    };
  }
}
