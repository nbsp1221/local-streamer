interface RevokeSessionRepository {
  revoke: (id: string) => Promise<void>;
}

interface DestroyAuthSessionUseCaseDependencies {
  sessionRepository: RevokeSessionRepository;
}

interface DestroyAuthSessionUseCaseInput {
  sessionId?: string | null;
}

export class DestroyAuthSessionUseCase {
  constructor(private readonly deps: DestroyAuthSessionUseCaseDependencies) {}

  async execute(input: DestroyAuthSessionUseCaseInput): Promise<void> {
    if (!input.sessionId) {
      return;
    }

    await this.deps.sessionRepository.revoke(input.sessionId);
  }
}
