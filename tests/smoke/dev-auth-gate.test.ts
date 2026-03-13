import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from 'bun:test';
import { createNoEnvFileBunCommand } from '../../scripts/no-env-file-bun';
import { toRequestCookieHeader } from '../helpers/cookies';
import { createSmokeServerEnv } from './support/create-smoke-server-env';

const repoRoot = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'local-streamer-dev-smoke-'));
const authDbPath = join(tempDir, 'auth.sqlite');
const storageDir = join(tempDir, 'storage');
const port = 3400 + Math.floor(Math.random() * 200);
const baseUrl = `http://127.0.0.1:${port}`;
setDefaultTimeout(15_000);

let server: Bun.Subprocess | null = null;
const serverLogState = {
  stderr: '',
  stdout: '',
};
const serverLogReaders: Promise<void>[] = [];

function captureServerOutput(
  stream: number | ReadableStream<Uint8Array> | null | undefined,
  target: keyof typeof serverLogState,
) {
  if (!(stream instanceof ReadableStream)) {
    return;
  }

  serverLogReaders.push((async () => {
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        serverLogState[target] += decoder.decode(value, { stream: true });
      }

      serverLogState[target] += decoder.decode();
    }
    finally {
      reader.releaseLock();
    }
  })());
}

function formatServerLogs() {
  return [
    '=== SERVER STDERR ===',
    serverLogState.stderr || '(empty)',
    '=== SERVER STDOUT ===',
    serverLogState.stdout || '(empty)',
  ].join('\n');
}

function seedSmokeStorage(rootDir: string) {
  mkdirSync(join(rootDir, 'data'), { recursive: true });
  mkdirSync(join(rootDir, 'uploads', 'thumbnails'), { recursive: true });

  writeFileSync(join(rootDir, 'data', 'pending.json'), '[]');
  writeFileSync(join(rootDir, 'data', 'playlist-items.json'), '[]');
  writeFileSync(join(rootDir, 'data', 'playlists.json'), '[]');
  writeFileSync(join(rootDir, 'data', 'sessions.json'), '[]');
  writeFileSync(join(rootDir, 'data', 'videos.json'), '[]');
  writeFileSync(
    join(rootDir, 'data', 'users.json'),
    JSON.stringify([
      {
        id: 'legacy-admin-1',
        email: 'admin@example.com',
        passwordHash: 'not-used-by-phase-1',
        role: 'admin',
        createdAt: '2025-10-05T17:17:46.248Z',
        updatedAt: '2025-10-05T17:17:46.248Z',
      },
    ]),
  );
}

async function waitForServerReady(url: string) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (server && server.exitCode !== null) {
      throw new Error(
        `Dev smoke server exited early with code ${server.exitCode}\n${formatServerLogs()}`,
      );
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

  throw new Error(`Timed out waiting for dev smoke server at ${url}\n${formatServerLogs()}`);
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

  if (response.status !== 200 || !setCookie?.includes('site_session=')) {
    const responseBody = await response.text();

    throw new Error(
      [
        `Expected successful dev login but received ${response.status}.`,
        '=== LOGIN RESPONSE BODY ===',
        responseBody || '(empty)',
        formatServerLogs(),
      ].join('\n'),
    );
  }

  return toRequestCookieHeader(setCookie);
}

beforeAll(async () => {
  seedSmokeStorage(storageDir);

  server = Bun.spawn(createNoEnvFileBunCommand(['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)]), {
    cwd: repoRoot,
    env: createSmokeServerEnv({
      AUTH_SHARED_PASSWORD: 'vault-password',
      AUTH_SQLITE_PATH: authDbPath,
      STORAGE_DIR: storageDir,
    }),
    stderr: 'pipe',
    stdout: 'pipe',
  });
  serverLogState.stdout = '';
  serverLogState.stderr = '';
  serverLogReaders.length = 0;
  captureServerOutput(server.stdout, 'stdout');
  captureServerOutput(server.stderr, 'stderr');

  await waitForServerReady(baseUrl);
});

afterAll(async () => {
  if (server) {
    server.kill();
    await server.exited;
  }

  await Promise.all(serverLogReaders);

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
