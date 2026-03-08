import { describe, expect, test } from 'vitest';
import { getCookieValue } from '../../../app/shared/lib/http/cookies.server';

describe('cookies.server', () => {
  test('returns null for malformed percent-encoded cookie values', () => {
    const request = new Request('http://localhost', {
      headers: {
        cookie: 'site_auth_client=%E0%A4%A',
      },
    });

    expect(getCookieValue(request, 'site_auth_client')).toBeNull();
  });
});
