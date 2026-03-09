import crypto from 'node:crypto';
import type {
  ClearKeyRequest,
  ClearKeyResponse,
} from '~/legacy/modules/video/clear-key/clear-key.types';
import { ClearKeyUseCase } from '~/legacy/modules/video/clear-key/clear-key.usecase';
import { Pbkdf2KeyManagerAdapter } from '~/legacy/modules/video/security/adapters/pbkdf2-key-manager.adapter';
import type { PlaybackClearKeyService } from '../../application/ports/playback-clearkey-service.port';

interface LegacyClearKeyUseCaseResult {
  data?: ClearKeyResponse;
  error?: Error;
  success: boolean;
}

interface LegacyPlaybackClearKeyServiceAdapterDependencies {
  execute?: (input: ClearKeyRequest) => Promise<LegacyClearKeyUseCaseResult>;
}

export class LegacyPlaybackClearKeyServiceAdapter implements PlaybackClearKeyService {
  private readonly execute: (input: ClearKeyRequest) => Promise<LegacyClearKeyUseCaseResult>;

  constructor(deps: LegacyPlaybackClearKeyServiceAdapterDependencies = {}) {
    if (deps.execute) {
      this.execute = deps.execute;
      return;
    }

    const defaultUseCase = createLegacyClearKeyUseCase();
    this.execute = input => defaultUseCase.execute(input);
  }

  async serveLicense(input: { videoId: string }) {
    const result = await this.execute({
      request: new Request(`http://localhost/videos/${input.videoId}/clearkey`),
      videoId: input.videoId,
    });

    if (!result.success || !result.data) {
      throw result.error ?? new Error('Failed to load ClearKey license');
    }

    return {
      body: JSON.stringify(result.data.clearKeyResponse),
      headers: result.data.headers,
    };
  }
}

function createLegacyClearKeyUseCase() {
  const keyManager = new Pbkdf2KeyManagerAdapter();

  return new ClearKeyUseCase({
    jwtValidator: {
      validateVideoRequest: async () => ({
        payload: { userId: 'system' },
        valid: true,
      }),
    },
    keyManager: {
      getVideoKey: keyManager.retrieveKey.bind(keyManager),
      hasVideoKey: keyManager.keyExists.bind(keyManager),
    },
    keyUtils: {
      generateKeyId,
      hexToBase64Url,
    },
    logger: console,
  });
}

function hexToBase64Url(hex: string): string {
  return Buffer.from(hex, 'hex').toString('base64url');
}

function generateKeyId(videoId: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(videoId);

  return hash.digest().subarray(0, 16).toString('hex');
}
