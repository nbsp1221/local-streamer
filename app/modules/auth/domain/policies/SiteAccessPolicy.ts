import type { AuthDecision } from '../auth-session';

export type SiteSurface =
  | 'login-page'
  | 'auth-api'
  | 'protected-page'
  | 'protected-api'
  | 'media-resource';

interface SiteAccessPolicyInput {
  hasActiveSession: boolean;
  surface: SiteSurface;
}

export class SiteAccessPolicy {
  static evaluate(input: SiteAccessPolicyInput): AuthDecision {
    if (input.surface === 'login-page' || input.surface === 'auth-api') {
      return { allowed: true };
    }

    if (!input.hasActiveSession) {
      return {
        allowed: false,
        reason: 'AUTH_SESSION_REQUIRED',
      };
    }

    return { allowed: true };
  }
}
