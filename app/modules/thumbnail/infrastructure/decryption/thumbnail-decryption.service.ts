import type {
  ThumbnailDecryptionInput,
  ThumbnailDecryptionResult,
  ThumbnailDecryptionServicePort,
} from '../../application/ports/thumbnail-decryption-service.port';
import { LegacyThumbnailDecryptionServiceAdapter } from './legacy-thumbnail-decryption.service.adapter';

interface ThumbnailDecryptionServiceDependencies {
  logger?: Console;
}

// Temporary thumbnail-owned compatibility seam while thumbnail crypto still comes from legacy internals.
export class ThumbnailDecryptionService implements ThumbnailDecryptionServicePort {
  private readonly delegate: ThumbnailDecryptionServicePort;

  constructor(deps: ThumbnailDecryptionServiceDependencies = {}) {
    this.delegate = new LegacyThumbnailDecryptionServiceAdapter(deps);
  }

  async decryptThumbnail(input: ThumbnailDecryptionInput): Promise<ThumbnailDecryptionResult> {
    return this.delegate.decryptThumbnail(input);
  }
}
