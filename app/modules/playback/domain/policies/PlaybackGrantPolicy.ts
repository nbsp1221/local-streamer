export type PlaybackGrantDecision =
  | { allowed: true }
  | { allowed: false; reason: 'SITE_SESSION_REQUIRED' };

interface PlaybackGrantPolicyInput {
  hasSiteSession: boolean;
}

export class PlaybackGrantPolicy {
  static evaluate(input: PlaybackGrantPolicyInput): PlaybackGrantDecision {
    if (!input.hasSiteSession) {
      return {
        allowed: false,
        reason: 'SITE_SESSION_REQUIRED',
      };
    }

    return {
      allowed: true,
    };
  }
}
