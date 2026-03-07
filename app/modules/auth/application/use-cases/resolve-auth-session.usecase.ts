import type { AuthSession } from '../../domain/auth-session';
import { SessionPolicy } from '../../domain/policies/SessionPolicy';
import type { AuthSessionRepository } from '../ports/auth-session-repository.port';

interface ResolveAuthSessionUseCaseDependencies {
  sessionRepository: Pick<AuthSessionRepository, 'findById' | 'touch'>;
  sessionTtlMs: number;
}

interface ResolveAuthSessionUseCaseInput {
  now: Date;
  sessionId: string | null;
}

export class ResolveAuthSessionUseCase {
  constructor(private readonly deps: ResolveAuthSessionUseCaseDependencies) {}

  async execute(input: ResolveAuthSessionUseCaseInput): Promise<AuthSession | null> {
    if (!input.sessionId) {
      return null;
    }

    const session = await this.deps.sessionRepository.findById(input.sessionId);

    if (!session) {
      return null;
    }

    const decision = SessionPolicy.validate({
      now: input.now,
      session,
    });

    if (!decision.allowed) {
      return null;
    }

    const touchedSession: AuthSession = {
      ...session,
      expiresAt: new Date(input.now.getTime() + this.deps.sessionTtlMs),
      lastAccessedAt: input.now,
    };

    await this.deps.sessionRepository.touch({
      expiresAt: touchedSession.expiresAt,
      id: touchedSession.id,
      lastAccessedAt: touchedSession.lastAccessedAt,
    });

    return touchedSession;
  }
}
