import type { AuthSession } from '../../domain/auth-session';
import { SessionPolicy } from '../../domain/policies/SessionPolicy';
import type { AuthSessionRepository } from '../ports/auth-session-repository.port';
import type { SharedPasswordVerifier } from '../ports/shared-password-verifier.port';

interface CreateAuthSessionUseCaseDependencies {
  createSessionId: () => string;
  passwordVerifier: SharedPasswordVerifier;
  sessionRepository: AuthSessionRepository;
  sessionTtlMs: number;
}

interface CreateAuthSessionUseCaseInput {
  ipAddress?: string;
  now: Date;
  password: string;
  userAgent?: string;
}

type CreateAuthSessionUseCaseResult =
  | { ok: true; session: AuthSession }
  | { ok: false; reason: 'INVALID_SHARED_PASSWORD' };

export class CreateAuthSessionUseCase {
  constructor(private readonly deps: CreateAuthSessionUseCaseDependencies) {}

  async execute(input: CreateAuthSessionUseCaseInput): Promise<CreateAuthSessionUseCaseResult> {
    const passwordMatches = await this.deps.passwordVerifier.verify(input.password);

    if (!passwordMatches) {
      return {
        ok: false,
        reason: 'INVALID_SHARED_PASSWORD',
      };
    }

    const session = SessionPolicy.create({
      id: this.deps.createSessionId(),
      ipAddress: input.ipAddress,
      now: input.now,
      ttlMs: this.deps.sessionTtlMs,
      userAgent: input.userAgent,
    });

    await this.deps.sessionRepository.save(session);

    return {
      ok: true,
      session,
    };
  }
}
