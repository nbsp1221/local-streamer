import jwt, { type SignOptions } from 'jsonwebtoken';
import type { PlaybackTokenService as PlaybackTokenServicePort } from '../../application/ports/playback-token-service.port';
import { JsonWebTokenPlaybackTokenService } from './jsonwebtoken-playback-token.service';

interface PlaybackTokenRuntimeConfig {
  jwtAudience: string;
  jwtExpiry: SignOptions['expiresIn'];
  jwtIssuer: string;
  jwtSecret: string;
}

interface PlaybackTokenJwtRuntime {
  JsonWebTokenError: typeof jwt.JsonWebTokenError;
  TokenExpiredError: typeof jwt.TokenExpiredError;
  sign: typeof jwt.sign;
  verify: typeof jwt.verify;
}

interface PlaybackTokenServiceDependencies {
  config?: PlaybackTokenRuntimeConfig;
  jwt?: PlaybackTokenJwtRuntime;
}

// Temporary playback-owned compatibility seam while playback token config still comes from the legacy runtime config.
export class PlaybackTokenService implements PlaybackTokenServicePort {
  private readonly delegate: PlaybackTokenServicePort;

  constructor(deps: PlaybackTokenServiceDependencies = {}) {
    this.delegate = new JsonWebTokenPlaybackTokenService(deps);
  }

  async issue(input: Parameters<PlaybackTokenServicePort['issue']>[0]) {
    return this.delegate.issue(input);
  }

  async validate(token: string) {
    return this.delegate.validate(token);
  }
}
