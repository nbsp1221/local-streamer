import { afterEach, describe, expect, test, vi } from 'vitest';
import { ConfigSiteViewerResolver } from './config-site-viewer.resolver';

const ORIGINAL_AUTH_OWNER_EMAIL = process.env.AUTH_OWNER_EMAIL;
const ORIGINAL_AUTH_OWNER_ID = process.env.AUTH_OWNER_ID;

afterEach(() => {
  vi.resetModules();

  if (ORIGINAL_AUTH_OWNER_EMAIL === undefined) {
    delete process.env.AUTH_OWNER_EMAIL;
  }
  else {
    process.env.AUTH_OWNER_EMAIL = ORIGINAL_AUTH_OWNER_EMAIL;
  }

  if (ORIGINAL_AUTH_OWNER_ID === undefined) {
    delete process.env.AUTH_OWNER_ID;
  }
  else {
    process.env.AUTH_OWNER_ID = ORIGINAL_AUTH_OWNER_ID;
  }
});

describe('ConfigSiteViewerResolver', () => {
  test('returns the default config-owned viewer when auth owner env is unset', async () => {
    delete process.env.AUTH_OWNER_EMAIL;
    delete process.env.AUTH_OWNER_ID;

    const resolver = new ConfigSiteViewerResolver();

    await expect(resolver.resolveViewer()).resolves.toEqual({
      email: 'owner@local',
      id: 'site-owner',
      role: 'admin',
    });
  });

  test('returns the configured auth owner identity when env values are present', async () => {
    process.env.AUTH_OWNER_EMAIL = 'admin@example.com';
    process.env.AUTH_OWNER_ID = 'seeded-owner-1';

    const resolver = new ConfigSiteViewerResolver();

    await expect(resolver.resolveViewer()).resolves.toEqual({
      email: 'admin@example.com',
      id: 'seeded-owner-1',
      role: 'admin',
    });
  });
});
