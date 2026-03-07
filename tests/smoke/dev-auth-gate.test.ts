import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const repoRoot = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'local-streamer-dev-smoke-'));
const authDbPath = join(tempDir, 'auth.sqlite');
const port = 3400 + Math.floor(Math.random() * 200);
const baseUrl = `http://127.0.0.1:${port}`;

let server: Bun.Subprocess | null = null;

async function waitForServerReady(url: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server && server.exitCode !== null) {
      throw new Error(`Dev smoke server exited early with code ${server.exitCode}`);
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

  throw new Error(`Timed out waiting for dev smoke server at ${url}`);
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
  server = Bun.spawn(['bun', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AUTH_SHARED_PASSWORD: 'vault-password',
      AUTH_SQLITE_PATH: authDbPath,
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

describe('Dev auth gate smoke', () => {
  test('invalid shared password is rejected in dev', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      body: JSON.stringify({ password: 'wrong-password' }),
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });

    expect(response.status).toBe(401);
  });

  test('valid shared password logs in successfully in dev', async () => {
    const cookie = await loginAndGetCookie();
    const response = await fetch(`${baseUrl}/api/auth/me`, {
      headers: new Headers([
        ['Cookie', cookie],
      ]),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      success: true,
      user: expect.objectContaining({
        email: expect.any(String),
        id: expect.any(String),
        role: 'admin',
      }),
    }));
  });

  test('logout respects safe redirectTo and revokes the cookie in dev', async () => {
    const cookie = await loginAndGetCookie();
    const logoutResponse = await fetch(`${baseUrl}/api/auth/logout?redirectTo=%2Fgoodbye`, {
      headers: new Headers([
        ['Cookie', cookie],
      ]),
      redirect: 'manual',
    });

    expect(logoutResponse.status).toBe(302);
    expect(logoutResponse.headers.get('location')).toBe('/goodbye');
    expect(logoutResponse.headers.get('set-cookie')).toContain('site_session=');

    const authMeResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: new Headers([
        ['Cookie', cookie],
      ]),
    });

    expect(authMeResponse.status).toBe(401);
  });
});
