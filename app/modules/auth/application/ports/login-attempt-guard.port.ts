export interface LoginAttemptDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export interface EvaluateLoginAttemptInput {
  key: string;
  now: Date;
}

export interface RegisterLoginAttemptFailureInput {
  key: string;
  now: Date;
}

export interface LoginAttemptGuard {
  evaluate: (input: EvaluateLoginAttemptInput) => LoginAttemptDecision;
  registerFailure: (input: RegisterLoginAttemptFailureInput) => void;
  reset: (key: string) => void;
  runExclusive: <T>(key: string, task: () => Promise<T>) => Promise<T>;
}
