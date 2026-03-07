import { timingSafeEqual } from 'node:crypto';
import type { SharedPasswordVerifier } from '../../application/ports/shared-password-verifier.port';

interface EnvSharedPasswordVerifierOptions {
  sharedPassword: string;
}

export class EnvSharedPasswordVerifier implements SharedPasswordVerifier {
  constructor(private readonly options: EnvSharedPasswordVerifierOptions) {}

  async verify(password: string): Promise<boolean> {
    const expected = Buffer.from(this.options.sharedPassword);
    const actual = Buffer.from(password);

    if (expected.length !== actual.length) {
      return false;
    }

    return timingSafeEqual(actual, expected);
  }
}
