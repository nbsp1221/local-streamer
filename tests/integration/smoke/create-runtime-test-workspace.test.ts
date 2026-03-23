import { access, readFile } from 'node:fs/promises';
import { afterEach, describe, expect, test } from 'vitest';
import { createRuntimeTestWorkspace } from '../../support/create-runtime-test-workspace';

const cleanupTasks: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanupTasks.splice(0).map(task => task()));
});

describe('createRuntimeTestWorkspace', () => {
  test('creates an isolated runtime workspace with deterministic seeded storage', async () => {
    const workspace = await createRuntimeTestWorkspace();
    cleanupTasks.push(workspace.cleanup);

    expect(workspace.rootDir).not.toContain('/storage');
    expect(workspace.storageDir).toContain(workspace.rootDir);
    expect(workspace.authDbPath).toContain(workspace.rootDir);
    expect(workspace.videoMetadataDbPath).toBe(
      `${workspace.storageDir}/data/video-metadata.sqlite`,
    );

    await expect(access(`${workspace.storageDir}/data/videos.json`)).resolves.toBeUndefined();
    await expect(access(`${workspace.storageDir}/data/pending.json`)).resolves.toBeUndefined();
    await expect(access(`${workspace.storageDir}/data/playlists.json`)).resolves.toBeUndefined();
    await expect(access(`${workspace.storageDir}/data/playlist-items.json`)).resolves.toBeUndefined();
    await expect(access(`${workspace.storageDir}/data/users.json`)).resolves.toBeUndefined();
    await expect(access(workspace.videoMetadataDbPath)).rejects.toBeDefined();

    const videos = JSON.parse(await readFile(`${workspace.storageDir}/data/videos.json`, 'utf8')) as Array<{
      id: string;
      title: string;
      videoUrl: string;
    }>;

    expect(videos).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: '68e5f819-15e8-41ef-90ee-8a96769311b7',
        title: 'playtime',
        videoUrl: '/videos/68e5f819-15e8-41ef-90ee-8a96769311b7/manifest.mpd',
      }),
      expect.objectContaining({
        id: '754c6828-621c-4df6-9cf8-a3d77297b85a',
        title: 'playtime2',
        videoUrl: '/videos/754c6828-621c-4df6-9cf8-a3d77297b85a/manifest.mpd',
      }),
    ]));
  });
});
