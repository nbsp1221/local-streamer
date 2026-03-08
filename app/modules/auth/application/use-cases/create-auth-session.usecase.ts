import type { AuthSession } from '../../domain/auth-session';
import type { AuthSessionRepository } from '../ports/auth-session-repository.port';
import type { LoginAttemptGuard } from '../ports/login-attempt-guard.port';
import type { SharedPasswordVerifier } from '../ports/shared-password-verifier.port';
import { SessionPolicy } from '../../domain/policies/SessionPolicy';

interface CreateAuthSessionUseCaseDependencies {
  createSessionId: () => string;
  loginAttemptGuard?: LoginAttemptGuard;
  onInvalidPassword?: () => Promise<void>;
  passwordVerifier: SharedPasswordVerifier;
  sessionRepository: AuthSessionRepository;
  sessionTtlMs: number;
}

interface CreateAuthSessionUseCaseInput {
  attemptKey?: string;
  attemptKeys?: string[];
  ipAddress?: string;
  now: Date;
  password: string;
  userAgent?: string;
}

type CreateAuthSessionUseCaseResult =
  | { ok: true; session: AuthSession }
  | { ok: false; reason: 'INVALID_SHARED_PASSWORD' }
  | { ok: false; reason: 'RATE_LIMITED'; retryAfterSeconds: number };

export class CreateAuthSessionUseCase {
  constructor(private readonly deps: CreateAuthSessionUseCaseDependencies) {}

  async execute(input: CreateAuthSessionUseCaseInput): Promise<CreateAuthSessionUseCaseResult> {
    const attemptKeys = Array.from(
      new Set(
        (input.attemptKeys ?? [])
          .map(key => key.trim())
          .filter(Boolean),
      ),
    );
    const fallbackAttemptKey = input.attemptKey?.trim() || input.ipAddress?.trim() || input.userAgent?.trim() || 'global';

    if (attemptKeys.length === 0) {
      attemptKeys.push(fallbackAttemptKey);
    }

    const lockKey = attemptKeys[attemptKeys.length - 1] ?? fallbackAttemptKey;

    const performAttempt = async (): Promise<CreateAuthSessionUseCaseResult> => {
      for (const key of attemptKeys) {
        const attemptDecision = this.deps.loginAttemptGuard?.evaluate({
          key,
          now: input.now,
        });

        if (attemptDecision && !attemptDecision.allowed) {
          return {
            ok: false,
            reason: 'RATE_LIMITED',
            retryAfterSeconds: attemptDecision.retryAfterSeconds ?? 60,
          };
        }
      }

      const passwordMatches = await this.deps.passwordVerifier.verify(input.password);

      if (!passwordMatches) {
        for (const key of attemptKeys) {
          this.deps.loginAttemptGuard?.registerFailure({
            key,
            now: input.now,
          });
        }
        await this.deps.onInvalidPassword?.();

        return {
          ok: false,
          reason: 'INVALID_SHARED_PASSWORD',
        };
      }

      for (const key of attemptKeys) {
        this.deps.loginAttemptGuard?.reset(key);
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
    };

    if (this.deps.loginAttemptGuard) {
      return this.deps.loginAttemptGuard.runExclusive(lockKey, performAttempt);
    }

    return performAttempt();
  }
}
