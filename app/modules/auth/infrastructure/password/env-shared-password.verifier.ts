import { createHash, timingSafeEqual } from 'node:crypto';
import type { SharedPasswordVerifier } from '../../application/ports/shared-password-verifier.port';

interface EnvSharedPasswordVerifierOptions {
  sharedPassword: string;
}

export class EnvSharedPasswordVerifier implements SharedPasswordVerifier {
  constructor(private readonly options: EnvSharedPasswordVerifierOptions) {}

  async verify(password: string): Promise<boolean> {
    const expected = createHash('sha256').update(this.options.sharedPassword).digest();
    const actual = createHash('sha256').update(password).digest();

    return timingSafeEqual(actual, expected);
  }
}
