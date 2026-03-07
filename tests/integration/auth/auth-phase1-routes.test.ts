import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

interface AuthSessionRow {
  created_at: string;
  expires_at: string;
  id: string;
  ip_address: string | null;
  is_revoked: number;
  last_accessed_at: string;
  user_agent: string | null;
}

class InMemorySqliteDatabase {
  private readonly rows = new Map<string, AuthSessionRow>();

  exec(_sql: string) {}

  prepare<T>(sql: string) {
    if (sql.includes('SELECT') && sql.includes('FROM auth_sessions')) {
      return {
        get: (...params: unknown[]) => this.rows.get(String(params[0])) as T | undefined,
        run: () => {
          throw new Error('run() is not supported for SELECT statements in this test adapter');
        },
      };
    }

    if (sql.includes('INSERT OR REPLACE INTO auth_sessions')) {
      return {
        get: () => {
          throw new Error('get() is not supported for INSERT statements in this test adapter');
        },
        run: (...params: unknown[]) => {
          const [
            id,
            createdAt,
            expiresAt,
            ipAddress,
            isRevoked,
            lastAccessedAt,
            userAgent,
          ] = params as [string, string, string, string | null, number, string, string | null];
          this.rows.set(id, {
            created_at: createdAt,
            expires_at: expiresAt,
            id,
            ip_address: ipAddress,
            is_revoked: isRevoked,
            last_accessed_at: lastAccessedAt,
            user_agent: userAgent,
          });
          return { changes: 1 };
        },
      };
    }

    if (sql.includes('SET is_revoked = 1')) {
      return {
        get: () => {
          throw new Error('get() is not supported for UPDATE statements in this test adapter');
        },
        run: (...params: unknown[]) => {
          const [id] = params as [string];
          const row = this.rows.get(id);
          if (row) {
            this.rows.set(id, {
              ...row,
              is_revoked: 1,
            });
          }

          return { changes: row ? 1 : 0 };
        },
      };
    }

    if (sql.includes('SET') && sql.includes('expires_at = ?') && sql.includes('last_accessed_at = ?')) {
      return {
        get: () => {
          throw new Error('get() is not supported for UPDATE statements in this test adapter');
        },
        run: (...params: unknown[]) => {
          const [expiresAt, lastAccessedAt, id] = params as [string, string, string];
          const row = this.rows.get(id);
          if (row) {
            this.rows.set(id, {
              ...row,
              expires_at: expiresAt,
              last_accessed_at: lastAccessedAt,
            });
          }

          return { changes: row ? 1 : 0 };
        },
      };
    }

    throw new Error(`Unsupported SQL in test adapter: ${sql}`);
  }
}

async function importLoginAction() {
  return import('../../../app/routes/api.auth.login');
}

async function importRootModule() {
  return import('../../../app/root');
}

async function importAuthMeRoute() {
  return import('../../../app/routes/api.auth.me');
}

async function importLogoutRoute() {
  return import('../../../app/routes/api.auth.logout');
}

async function importHomeRoute() {
  return import('../../../app/routes/_index');
}

async function importVideoTokenRoute() {
  return import('../../../app/routes/videos.$videoId.token');
}

async function importManifestRoute() {
  return import('../../../app/routes/videos.$videoId.manifest[.]mpd');
}

async function importVideoSegmentRoute() {
  return import('../../../app/routes/videos.$videoId.video.$filename');
}

async function importAudioSegmentRoute() {
  return import('../../../app/routes/videos.$videoId.audio.$filename');
}

async function importClearKeyRoute() {
  return import('../../../app/routes/videos.$videoId.clearkey');
}

async function importThumbnailPreviewRoute() {
  return import('../../../app/routes/api.thumbnail-preview.$filename');
}

async function importThumbnailRoute() {
  return import('../../../app/routes/api.thumbnail.$id');
}

async function importEncryptedThumbnailRoute() {
  return import('../../../app/routes/api.thumbnail-encrypted.$id');
}

async function importPlaylistsRoute() {
  return import('../../../app/routes/api.playlists');
}

async function writeJsonFile(filePath: string, value: unknown) {
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

function expectAdminUser(user: unknown) {
  expect(user).toEqual(expect.objectContaining({
    email: expect.any(String),
    id: expect.any(String),
    role: 'admin',
  }));
}

async function seedStorage(storageDir: string, overrides?: {
  playlists?: unknown[];
  users?: unknown[];
}) {
  await mkdir(join(storageDir, 'data'), { recursive: true });
  await mkdir(join(storageDir, 'uploads', 'thumbnails'), { recursive: true });

  await writeJsonFile(join(storageDir, 'data', 'pending.json'), []);
  await writeJsonFile(join(storageDir, 'data', 'playlist-items.json'), []);
  await writeJsonFile(join(storageDir, 'data', 'playlists.json'), overrides?.playlists ?? []);
  await writeJsonFile(join(storageDir, 'data', 'sessions.json'), []);
  await writeJsonFile(join(storageDir, 'data', 'videos.json'), []);
  await writeJsonFile(
    join(storageDir, 'data', 'users.json'),
    overrides?.users ?? [
      {
        id: 'legacy-admin-1',
        email: 'admin@example.com',
        passwordHash: 'not-used-by-phase-1',
        role: 'admin',
        createdAt: '2025-10-05T17:17:46.248Z',
        updatedAt: '2025-10-05T17:17:46.248Z',
      },
    ],
  );
}

describe('Phase 1 auth gate routes', () => {
  let authDbPath: string;
  let sqliteDatabaseByPath: Map<string, InMemorySqliteDatabase>;
  let storageDir: string;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'local-streamer-phase1-auth-'));
    storageDir = join(tempDir, 'storage');
    await seedStorage(storageDir);
    authDbPath = join(tempDir, 'auth.sqlite');
    process.env.AUTH_SHARED_PASSWORD = 'vault-password';
    process.env.AUTH_SQLITE_PATH = authDbPath;
    process.env.STORAGE_DIR = storageDir;
    sqliteDatabaseByPath = new Map<string, InMemorySqliteDatabase>();
    vi.resetModules();
    vi.doMock('../../../app/modules/auth/infrastructure/sqlite/bun-sqlite.database', () => ({
      createBunSqliteDatabase: async ({ dbPath }: { dbPath: string }) => {
        let database = sqliteDatabaseByPath.get(dbPath);

        if (!database) {
          database = new InMemorySqliteDatabase();
          sqliteDatabaseByPath.set(dbPath, database);
        }

        return database;
      },
    }));
  });

  afterEach(async () => {
    delete process.env.AUTH_SHARED_PASSWORD;
    delete process.env.AUTH_SQLITE_PATH;
    delete process.env.STORAGE_DIR;
    vi.resetModules();
    await rm(tempDir, { force: true, recursive: true });
  });

  test('login action creates a session cookie for the shared password', async () => {
    const { action } = await importLoginAction();
    const request = new Request('http://localhost/api/auth/login', {
      body: JSON.stringify({ password: 'vault-password' }),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'vitest',
      },
      method: 'POST',
    });

    const response = await action({ request } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Set-Cookie')).toContain('site_session=');
    expect(payload).toEqual({
      success: true,
      user: expect.any(Object),
    });
    expectAdminUser(payload.user);
  });

  test('protected home route redirects unauthenticated requests to login', async () => {
    const { loader } = await importHomeRoute();
    const request = new Request('http://localhost/');

    await expect(loader({ request } as never)).rejects.toMatchObject({
      headers: expect.any(Headers),
      status: 302,
    });
  });

  test('root loader exposes a legacy-compatible user when a site session exists', async () => {
    const { action } = await importLoginAction();
    const loginResponse = await action({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();

    const { loader } = await importRootModule();
    const response = await loader({
      request: new Request('http://localhost/', {
        headers: {
          cookie: cookie ?? '',
        },
      }),
    } as never);

    expect(response).toEqual({
      user: expect.any(Object),
    });
    expectAdminUser(response.user);
  });

  test('auth me returns the legacy-compatible user for an active session', async () => {
    const { action } = await importLoginAction();
    const loginResponse = await action({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();

    const { loader } = await importAuthMeRoute();
    const response = await loader({
      request: new Request('http://localhost/api/auth/me', {
        headers: {
          cookie: cookie ?? '',
        },
      }),
    } as never);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({
      success: true,
      user: expect.any(Object),
    });
    expectAdminUser(payload.user);
  });

  test('logout revokes the active session cookie', async () => {
    const { action: loginAction } = await importLoginAction();
    const loginResponse = await loginAction({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();

    const { action: logoutAction } = await importLogoutRoute();
    const logoutResponse = await logoutAction({
      request: new Request('http://localhost/api/auth/logout', {
        headers: {
          cookie: cookie ?? '',
        },
        method: 'POST',
      }),
    } as never);

    expect(logoutResponse.status).toBe(302);
    expect(logoutResponse.headers.get('Set-Cookie')).toContain('site_session=');
  });

  test('logout revokes the server-side session so the old cookie can no longer authenticate', async () => {
    const { action: loginAction } = await importLoginAction();
    const loginResponse = await loginAction({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();

    const { action: logoutAction } = await importLogoutRoute();
    const logoutResponse = await logoutAction({
      request: new Request('http://localhost/api/auth/logout', {
        headers: {
          cookie: cookie ?? '',
        },
        method: 'POST',
      }),
    } as never);

    expect(logoutResponse.status).toBe(302);

    const { loader: authMeLoader } = await importAuthMeRoute();
    const authMeResponse = await authMeLoader({
      request: new Request('http://localhost/api/auth/me', {
        headers: {
          cookie: cookie ?? '',
        },
      }),
    } as never);

    expect(authMeResponse.status).toBe(401);
    await expect(authMeResponse.json()).resolves.toEqual({
      error: 'Not authenticated',
      success: false,
    });
  });

  test('login rejects an invalid shared password without issuing a session cookie', async () => {
    const { action } = await importLoginAction();
    const response = await action({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'wrong-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    expect(response.status).toBe(401);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid password',
      success: false,
    });
  });

  test('logout respects redirectTo when provided', async () => {
    const { action: loginAction } = await importLoginAction();
    const loginResponse = await loginAction({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();

    const { action: logoutAction } = await importLogoutRoute();
    const logoutResponse = await logoutAction({
      request: new Request('http://localhost/api/auth/logout?redirectTo=%2Fgoodbye', {
        headers: {
          cookie: cookie ?? '',
        },
        method: 'POST',
      }),
    } as never);

    expect(logoutResponse.status).toBe(302);
    expect(logoutResponse.headers.get('Location')).toBe('/goodbye');
  });

  test('get logout also respects redirectTo when provided', async () => {
    const { loader } = await importLogoutRoute();
    const response = await loader({
      request: new Request('http://localhost/api/auth/logout?redirectTo=%2Fgoodbye'),
    } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/goodbye');
    expect(response.headers.get('Set-Cookie')).toContain('site_session=');
  });

  test.each([
    'https://evil.example',
    '//evil.example',
  ])('logout action ignores unsafe redirectTo %s', async (unsafeRedirectTo) => {
    const { action: loginAction } = await importLoginAction();
    const loginResponse = await loginAction({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();

    const { action: logoutAction } = await importLogoutRoute();
    const response = await logoutAction({
      request: new Request(
        `http://localhost/api/auth/logout?redirectTo=${encodeURIComponent(unsafeRedirectTo)}`,
        {
          headers: {
            cookie: cookie ?? '',
          },
          method: 'POST',
        },
      ),
    } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/login');
  });

  test.each([
    'https://evil.example',
    '//evil.example',
  ])('logout loader ignores unsafe redirectTo %s', async (unsafeRedirectTo) => {
    const { loader } = await importLogoutRoute();
    const response = await loader({
      request: new Request(
        `http://localhost/api/auth/logout?redirectTo=${encodeURIComponent(unsafeRedirectTo)}`,
      ),
    } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/login');
  });

  test('video token route denies unauthenticated requests before issuing playback tokens', async () => {
    const { loader } = await importVideoTokenRoute();
    const request = new Request('http://localhost/videos/video-1/token');

    const response = await loader({
      params: { videoId: 'video-1' },
      request,
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
      success: false,
    });
  });

  test.each([
    {
      importRoute: importManifestRoute,
      label: 'manifest',
      params: { videoId: 'video-1' },
      url: 'http://localhost/videos/video-1/manifest.mpd',
    },
    {
      importRoute: importVideoSegmentRoute,
      label: 'video segment',
      params: { filename: 'init.mp4', videoId: 'video-1' },
      url: 'http://localhost/videos/video-1/video/init.mp4',
    },
    {
      importRoute: importAudioSegmentRoute,
      label: 'audio segment',
      params: { filename: 'init.mp4', videoId: 'video-1' },
      url: 'http://localhost/videos/video-1/audio/init.mp4',
    },
    {
      importRoute: importClearKeyRoute,
      label: 'clearkey license',
      params: { videoId: 'video-1' },
      url: 'http://localhost/videos/video-1/clearkey',
    },
    {
      importRoute: importThumbnailRoute,
      label: 'thumbnail',
      params: { id: 'video-1' },
      url: 'http://localhost/api/thumbnail/video-1',
    },
    {
      importRoute: importEncryptedThumbnailRoute,
      label: 'encrypted thumbnail',
      params: { id: 'video-1' },
      url: 'http://localhost/api/thumbnail-encrypted/video-1',
    },
    {
      importRoute: importThumbnailPreviewRoute,
      label: 'thumbnail preview',
      params: { filename: 'preview.jpg' },
      url: 'http://localhost/api/thumbnail-preview/preview.jpg',
    },
  ])('protected $label route denies unauthenticated access', async ({ importRoute, params, url }) => {
    const routeModule = await importRoute();
    const response = await routeModule.loader({
      params,
      request: new Request(url),
    } as never);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Authentication required',
      success: false,
    });
  });

  test('protected thumbnail preview responses use private cache semantics', async () => {
    await writeFile(
      join(storageDir, 'uploads', 'thumbnails', 'preview.jpg'),
      Buffer.from('preview-bytes'),
    );

    const { action } = await importLoginAction();
    const loginResponse = await action({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();

    const { loader } = await importThumbnailPreviewRoute();
    const response = await loader({
      params: { filename: 'preview.jpg' },
      request: new Request('http://localhost/api/thumbnail-preview/preview.jpg', {
        headers: {
          cookie: cookie ?? '',
        },
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('private');
    expect(response.headers.get('Cache-Control')).not.toContain('public');
  });

  test('encrypted thumbnail delivery works with the site session without a legacy session cookie', async () => {
    vi.doMock('../../../app/legacy/modules/thumbnail/decrypt-thumbnail/decrypt-thumbnail.usecase', () => ({
      DecryptThumbnailUseCase: class {
        async execute() {
          return {
            data: {
              imageBuffer: new Uint8Array([1, 2, 3]),
              mimeType: 'image/jpeg',
              size: 3,
            },
            success: true,
          };
        }
      },
    }));
    vi.resetModules();

    const { action } = await importLoginAction();
    const loginResponse = await action({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toContain('site_session=');
    expect(cookie).not.toContain('session_id=');

    const { loader } = await importEncryptedThumbnailRoute();
    const response = await loader({
      params: { id: 'video-123' },
      request: new Request('http://localhost/api/thumbnail/video-123', {
        headers: {
          cookie: cookie ?? '',
        },
      }),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get('X-Content-Source')).toBe('encrypted-thumbnail');
  });

  test('root loader creates a compatibility legacy admin when no legacy users exist', async () => {
    await seedStorage(storageDir, { users: [] });
    vi.resetModules();

    const { action } = await importLoginAction();
    const loginResponse = await action({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();

    const { loader } = await importRootModule();
    const response = await loader({
      request: new Request('http://localhost/', {
        headers: {
          cookie: cookie ?? '',
        },
      }),
    } as never);

    expect(response).toEqual({
      user: expect.any(Object),
    });
    expectAdminUser(response.user);
  });

  test('playlist creation does not fail on a clean install without legacy users', async () => {
    await seedStorage(storageDir, {
      playlists: [],
      users: [],
    });
    vi.resetModules();

    const { action: loginAction } = await importLoginAction();
    const loginResponse = await loginAction({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();

    const { action } = await importPlaylistsRoute();
    const response = await action({
      request: new Request('http://localhost/api/playlists', {
        body: JSON.stringify({
          description: 'Created after auth migration',
          name: 'Compat Playlist',
          type: 'user_created',
        }),
        headers: new Headers([
          ['Content-Type', 'application/json'],
          ['Cookie', cookie ?? ''],
        ]),
        method: 'POST',
      }),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      success: true,
    }));
  });

  test('playlist listing returns owner playlists for the compatibility identity after login', async () => {
    await seedStorage(storageDir, {
      playlists: [
        {
          createdAt: '2025-10-05T17:17:46.248Z',
          description: 'Owned by the compatibility user',
          id: 'playlist-1',
          isPublic: false,
          name: 'Owned Playlist',
          ownerId: 'legacy-admin-1',
          type: 'user_created',
          updatedAt: '2025-10-05T17:17:46.248Z',
          videoIds: [],
        },
      ],
    });
    vi.resetModules();

    const { action: loginAction } = await importLoginAction();
    const loginResponse = await loginAction({
      request: new Request('http://localhost/api/auth/login', {
        body: JSON.stringify({ password: 'vault-password' }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }),
    } as never);

    const cookie = loginResponse.headers.get('Set-Cookie');
    expect(cookie).toBeTruthy();

    const { loader } = await importPlaylistsRoute();
    const response = await loader({
      request: new Request('http://localhost/api/playlists?includeEmpty=true&limit=100', {
        headers: {
          cookie: cookie ?? '',
        },
      }),
    } as never);

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual(expect.objectContaining({
      playlists: expect.arrayContaining([
        expect.objectContaining({
          id: 'playlist-1',
          name: 'Owned Playlist',
          ownerId: expect.any(String),
        }),
      ]),
      success: true,
    }));
  });
});
