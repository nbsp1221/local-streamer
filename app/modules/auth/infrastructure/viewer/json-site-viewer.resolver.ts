import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SiteViewer } from '~/modules/auth/domain/site-viewer';

interface StoredUser {
  createdAt?: string;
  email: string;
  id: string;
  passwordHash?: string;
  role: 'admin' | 'user';
  updatedAt?: string;
}

const FALLBACK_VIEWER: StoredUser = {
  email: 'vault@local',
  id: 'vault-owner',
  passwordHash: 'shared-password-auth-not-used',
  role: 'admin',
};

function getUsersJsonPath() {
  const storageDir = process.env.STORAGE_DIR
    ? path.resolve(process.env.STORAGE_DIR)
    : path.resolve(process.cwd(), 'storage');

  return path.join(storageDir, 'data', 'users.json');
}

function toViewer(user: StoredUser): SiteViewer {
  return {
    email: user.email,
    id: user.id,
    role: user.role,
  };
}

function pickStoredViewer(users: StoredUser[]) {
  return users.find(user => user.email === FALLBACK_VIEWER.email) ??
    users.find(user => user.role === 'admin') ??
    users[0];
}

async function readUsers(filePath: string): Promise<StoredUser[]> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as StoredUser[];
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function writeUsers(filePath: string, users: StoredUser[]) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(users, null, 2));
}

export class JsonSiteViewerResolver {
  async resolveViewer(): Promise<SiteViewer> {
    const usersJson = getUsersJsonPath();
    const users = await readUsers(usersJson);
    const existingViewer = pickStoredViewer(users);

    if (existingViewer) {
      return toViewer(existingViewer);
    }

    const now = new Date().toISOString();
    const fallbackViewer: StoredUser = {
      ...FALLBACK_VIEWER,
      createdAt: now,
      updatedAt: now,
    };

    await writeUsers(usersJson, [fallbackViewer]);

    return toViewer(fallbackViewer);
  }
}
