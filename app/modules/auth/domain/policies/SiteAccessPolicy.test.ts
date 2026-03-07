import { describe, expect, test } from 'vitest';
import { SiteAccessPolicy } from './SiteAccessPolicy';

describe('SiteAccessPolicy', () => {
  test('allows login page without a session', () => {
    const decision = SiteAccessPolicy.evaluate({
      hasActiveSession: false,
      surface: 'login-page',
    });

    expect(decision).toEqual({ allowed: true });
  });

  test('denies protected pages without a session', () => {
    const decision = SiteAccessPolicy.evaluate({
      hasActiveSession: false,
      surface: 'protected-page',
    });

    expect(decision).toEqual({
      allowed: false,
      reason: 'AUTH_SESSION_REQUIRED',
    });
  });

  test('allows protected pages with an active session', () => {
    const decision = SiteAccessPolicy.evaluate({
      hasActiveSession: true,
      surface: 'protected-page',
    });

    expect(decision).toEqual({ allowed: true });
  });

  test('denies media access without a session', () => {
    const decision = SiteAccessPolicy.evaluate({
      hasActiveSession: false,
      surface: 'media-resource',
    });

    expect(decision).toEqual({
      allowed: false,
      reason: 'AUTH_SESSION_REQUIRED',
    });
  });
});
