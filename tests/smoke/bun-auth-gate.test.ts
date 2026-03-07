import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'local-streamer-bun-smoke-'));
const authDbPath = join(tempDir, 'auth.sqlite');
const port = 3200 + Math.floor(Math.random() * 200);
const baseUrl = `http://127.0.0.1:${port}`;
const syntheticVideoId = 'smoke-video-id';

let server: Bun.Subprocess | null = null;

async function waitForServerReady(url: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (server && server.exitCode !== null) {
      throw new Error(`Bun smoke server exited early with code ${server.exitCode}`);
    }

    try {
      const response = await fetch(`${url}/login`);
      if (response.ok) {
        return;
      }
    }
    catch {
      // Wait for the next retry.
    }

    await Bun.sleep(100);
  }

  throw new Error(`Timed out waiting for Bun smoke server at ${url}`);
}

async function loginAndGetCookie() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    body: JSON.stringify({ password: 'vault-password' }),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const setCookie = response.headers.get('set-cookie');

  expect(response.status).toBe(200);
  expect(setCookie).toContain('site_session=');

  return setCookie ?? '';
}

beforeAll(async () => {
  server = Bun.spawn(['bun', './build/server/index.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AUTH_SHARED_PASSWORD: 'vault-password',
      AUTH_SQLITE_PATH: authDbPath,
      PORT: String(port),
    },
    stderr: 'pipe',
    stdout: 'pipe',
  });

  await waitForServerReady(baseUrl);
});

afterAll(async () => {
  if (server) {
    server.kill();
    await server.exited;
  }

  rmSync(tempDir, { force: true, recursive: true });
});

describe('Bun auth gate smoke', () => {
  test('unauthenticated root redirects to login', async () => {
    const response = await fetch(`${baseUrl}/`, {
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/login?redirectTo=%2F');
  });

  test('invalid shared password is rejected', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      body: JSON.stringify({ password: 'wrong-password' }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  test('authenticated token and protected auth routes respond under Bun', async () => {
    const cookie = await loginAndGetCookie();
    const headers = new Headers([
      ['Cookie', cookie],
    ]);

    const [authMeResponse, tokenResponse, thumbnailResponse] = await Promise.all([
      fetch(`${baseUrl}/api/auth/me`, { headers }),
      fetch(`${baseUrl}/videos/${syntheticVideoId}/token`, { headers }),
      fetch(`${baseUrl}/api/thumbnail-encrypted/${syntheticVideoId}`, { headers }),
    ]);

    expect(authMeResponse.status).toBe(200);
    expect(tokenResponse.status).toBe(200);
    expect(thumbnailResponse.status).not.toBe(401);
  });
});
