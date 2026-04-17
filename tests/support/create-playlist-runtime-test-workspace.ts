import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { vi } from 'vitest';
import { toRequestCookieHeader } from '../helpers/cookies';
import { createRuntimeTestWorkspace } from './create-runtime-test-workspace';
import { type SeedLibraryVideoInput, seedLibraryVideoMetadata } from './seed-library-video-metadata';

export const PLAYLIST_OWNER_ID = 'seeded-owner-1';

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

interface PlaylistRuntimeWorkspaceOptions {
  playlistItems?: unknown[];
  playlists?: unknown[];
  videos?: SeedLibraryVideoInput[];
}

const DEFAULT_VIDEOS = [
  {
    createdAt: '2026-03-21T00:00:00.000Z',
    description: 'Fixture video one',
    duration: 90,
    id: 'playlist-video-1',
    tags: ['vault', 'action'],
    thumbnailUrl: '/api/thumbnail/playlist-video-1',
    title: 'Playlist Fixture One',
    videoUrl: '/videos/playlist-video-1/manifest.mpd',
  },
  {
    createdAt: '2026-03-22T00:00:00.000Z',
    description: 'Fixture video two',
    duration: 120,
    id: 'playlist-video-2',
    tags: ['vault'],
    thumbnailUrl: '/api/thumbnail/playlist-video-2',
    title: 'Playlist Fixture Two',
    videoUrl: '/videos/playlist-video-2/manifest.mpd',
  },
];

const DEFAULT_PLAYLISTS = [
  {
    createdAt: '2026-03-23T00:00:00.000Z',
    description: 'Owned private playlist',
    id: 'playlist-owned-private',
    isPublic: false,
    name: 'Owned Private Playlist',
    ownerId: PLAYLIST_OWNER_ID,
    type: 'user_created',
    updatedAt: '2026-03-24T00:00:00.000Z',
    videoIds: ['playlist-video-1'],
  },
  {
    createdAt: '2026-03-24T00:00:00.000Z',
    description: 'Public playlist for anonymous access paths',
    id: 'playlist-public',
    isPublic: true,
    name: 'Public Playlist',
    ownerId: 'other-user',
    type: 'user_created',
    updatedAt: '2026-03-25T00:00:00.000Z',
    videoIds: ['playlist-video-2'],
  },
];

const DEFAULT_PLAYLIST_ITEMS = [
  {
    addedAt: '2026-03-24T00:00:00.000Z',
    addedBy: PLAYLIST_OWNER_ID,
    playlistId: 'playlist-owned-private',
    position: 1,
    videoId: 'playlist-video-1',
  },
  {
    addedAt: '2026-03-25T00:00:00.000Z',
    addedBy: 'other-user',
    playlistId: 'playlist-public',
    position: 1,
    videoId: 'playlist-video-2',
  },
];

interface PlaylistRuntimeWorkspace {
  authDbPath: string;
  cleanup: () => Promise<void>;
  login: () => Promise<string>;
  rootDir: string;
  storageDir: string;
  videoMetadataDbPath: string;
}

async function writeJsonFile(filePath: string, value: unknown) {
  await writeFile(filePath, JSON.stringify(value, null, 2));
}

export async function createPlaylistRuntimeTestWorkspace(
  options: PlaylistRuntimeWorkspaceOptions = {},
): Promise<PlaylistRuntimeWorkspace> {
  const workspace = await createRuntimeTestWorkspace();
  const dataDir = join(workspace.storageDir, 'data');

  await Promise.all([
    writeJsonFile(join(dataDir, 'playlist-items.json'), options.playlistItems ?? DEFAULT_PLAYLIST_ITEMS),
    writeJsonFile(join(dataDir, 'playlists.json'), options.playlists ?? DEFAULT_PLAYLISTS),
  ]);

  process.env.AUTH_OWNER_EMAIL = 'admin@example.com';
  process.env.AUTH_OWNER_ID = PLAYLIST_OWNER_ID;
  process.env.AUTH_SHARED_PASSWORD = 'vault-password';
  process.env.AUTH_SQLITE_PATH = workspace.authDbPath;
  process.env.STORAGE_DIR = workspace.storageDir;
  process.env.VIDEO_METADATA_SQLITE_PATH = workspace.videoMetadataDbPath;
  delete process.env.VIDEO_JWT_SECRET;
  delete process.env.VIDEO_MASTER_ENCRYPTION_SEED;

  await seedLibraryVideoMetadata(
    workspace.videoMetadataDbPath,
    options.videos ?? DEFAULT_VIDEOS,
  );

  const sqliteDatabaseByPath = new Map<string, InMemorySqliteDatabase>();
  vi.resetModules();
  vi.doMock('../../app/modules/auth/infrastructure/sqlite/bun-sqlite.database', () => ({
    createBunSqliteDatabase: async ({ dbPath }: { dbPath: string }) => {
      let database = sqliteDatabaseByPath.get(dbPath);

      if (!database) {
        database = new InMemorySqliteDatabase();
        sqliteDatabaseByPath.set(dbPath, database);
      }

      return database;
    },
  }));

  return {
    authDbPath: workspace.authDbPath,
    cleanup: async () => {
      vi.doUnmock('../../app/modules/auth/infrastructure/sqlite/bun-sqlite.database');
      delete process.env.AUTH_OWNER_EMAIL;
      delete process.env.AUTH_OWNER_ID;
      delete process.env.AUTH_SHARED_PASSWORD;
      delete process.env.AUTH_SQLITE_PATH;
      delete process.env.STORAGE_DIR;
      delete process.env.VIDEO_METADATA_SQLITE_PATH;
      delete process.env.VIDEO_JWT_SECRET;
      delete process.env.VIDEO_MASTER_ENCRYPTION_SEED;
      await workspace.cleanup();
    },
    login: async () => {
      const { action } = await import('../../app/routes/api.auth.login');
      const response = await action({
        request: new Request('http://localhost/api/auth/login', {
          body: JSON.stringify({ password: 'vault-password' }),
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
        }),
      } as never);

      return toRequestCookieHeader(response.headers.get('Set-Cookie'));
    },
    rootDir: workspace.rootDir,
    storageDir: workspace.storageDir,
    videoMetadataDbPath: workspace.videoMetadataDbPath,
  };
}
