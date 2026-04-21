import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createNoEnvFileBunCommand } from '../../scripts/no-env-file-bun';
import { toRequestCookieHeader } from '../helpers/cookies';
import { createRuntimeTestEnv } from '../support/create-runtime-test-env';

const repoRoot = process.cwd();
const tempDir = mkdtempSync(join(tmpdir(), 'local-streamer-bun-smoke-'));
const authDbPath = join(tempDir, 'auth.sqlite');
const storageDir = join(tempDir, 'storage');
const port = 3200 + Math.floor(Math.random() * 200);
const baseUrl = `http://127.0.0.1:${port}`;
const syntheticVideoId = '00000000-0000-4000-8000-000000000001';

let server: Bun.Subprocess | null = null;

function expectAdminViewerShape(viewer: unknown) {
  expect(viewer).toEqual(expect.objectContaining({
    email: expect.stringMatching(/\S/),
    id: expect.stringMatching(/\S/),
    role: 'admin',
  }));
}

function seedSmokeStorage(rootDir: string) {
  mkdirSync(join(rootDir, 'data'), { recursive: true });

  writeFileSync(join(rootDir, 'data', 'playlist-items.json'), '[]');
  writeFileSync(join(rootDir, 'data', 'playlists.json'), '[]');
  writeFileSync(join(rootDir, 'data', 'sessions.json'), '[]');
}

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

  return toRequestCookieHeader(setCookie);
}

beforeAll(async () => {
  seedSmokeStorage(storageDir);

  server = Bun.spawn(createNoEnvFileBunCommand(['./build/server/index.js']), {
    cwd: repoRoot,
    env: createRuntimeTestEnv({
      AUTH_OWNER_EMAIL: 'admin@example.com',
      AUTH_OWNER_ID: 'seeded-owner-1',
      AUTH_SHARED_PASSWORD: 'vault-password',
      AUTH_SQLITE_PATH: authDbPath,
      PORT: String(port),
      STORAGE_DIR: storageDir,
    }),
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
    expect(response.headers.get('set-cookie')).not.toContain('site_session=');
  });

  test('authenticated token and protected thumbnail routes respond deterministically under Bun', async () => {
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
    const authMePayload = await authMeResponse.json();
    expect(authMePayload).toEqual(expect.objectContaining({
      success: true,
    }));
    expectAdminViewerShape(authMePayload.user);
    expect(tokenResponse.status).toBe(200);
    expect(thumbnailResponse.status).toBe(404);
    await expect(thumbnailResponse.text()).resolves.toBe('Encrypted thumbnail not found');
  });

  test('authenticated playlist APIs create and list owner playlists under Bun', async () => {
    const cookie = await loginAndGetCookie();

    const createResponse = await fetch(`${baseUrl}/api/playlists`, {
      body: JSON.stringify({
        name: 'Bun Smoke Playlist',
        type: 'user_created',
      }),
      headers: new Headers([
        ['Content-Type', 'application/json'],
        ['Cookie', cookie],
      ]),
      method: 'POST',
    });

    expect(createResponse.status).toBe(200);
    const createPayload = await createResponse.json();
    expect(createPayload).toEqual(expect.objectContaining({
      playlistId: expect.any(String),
      success: true,
    }));

    const listResponse = await fetch(`${baseUrl}/api/playlists`, {
      headers: new Headers([
        ['Cookie', cookie],
      ]),
    });

    expect(listResponse.status).toBe(200);
    const listPayload = await listResponse.json();
    expect(listPayload).toEqual(expect.objectContaining({
      playlists: expect.arrayContaining([
        expect.objectContaining({
          name: 'Bun Smoke Playlist',
          ownerId: 'seeded-owner-1',
        }),
      ]),
      success: true,
    }));
  });
});
