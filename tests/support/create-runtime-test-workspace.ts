import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { copyPlaybackFixture } from './copy-playback-fixture';
import { REQUIRED_BROWSER_PLAYBACK_FIXTURE_IDS } from './playback-fixture-manifest';
import { seedLibraryVideoMetadata } from './seed-library-video-metadata';

interface RuntimeTestWorkspace {
  authDbPath: string;
  cleanup: () => Promise<void>;
  rootDir: string;
  storageDir: string;
  videoMetadataDbPath: string;
}

interface RuntimePendingVideoSeed {
  filename: string;
  id: string;
  size: number;
  type: string;
  createdAt?: string;
  path?: string;
  thumbnailUrl?: string;
}

interface CreateRuntimeTestWorkspaceOptions {
  pendingVideos?: RuntimePendingVideoSeed[];
}

const HOME_VIDEO_ID = '68e5f819-15e8-41ef-90ee-8a96769311b7';
const FILTERED_VIDEO_ID = '754c6828-621c-4df6-9cf8-a3d77297b85a';

const SEEDED_VIDEOS = [
  {
    createdAt: '2026-03-08T00:00:00.000Z',
    description: 'Playtime test upload',
    duration: 90,
    id: HOME_VIDEO_ID,
    tags: ['Action', 'vault'],
    thumbnailUrl: '/api/thumbnail/68e5f819-15e8-41ef-90ee-8a96769311b7',
    title: 'playtime',
    videoUrl: `/videos/${HOME_VIDEO_ID}/manifest.mpd`,
  },
  {
    createdAt: '2026-03-08T00:00:00.000Z',
    description: 'Playtime related fixture',
    duration: 105,
    id: FILTERED_VIDEO_ID,
    tags: ['ui'],
    thumbnailUrl: '/api/thumbnail/754c6828-621c-4df6-9cf8-a3d77297b85a',
    title: 'playtime2',
    videoUrl: `/videos/${FILTERED_VIDEO_ID}/manifest.mpd`,
  },
];

export async function createRuntimeTestWorkspace(
  options: CreateRuntimeTestWorkspaceOptions = {},
): Promise<RuntimeTestWorkspace> {
  const rootDir = await mkdtemp(join(tmpdir(), 'local-streamer-runtime-'));
  const storageDir = join(rootDir, 'storage');
  const dataDir = join(storageDir, 'data');
  const authDbPath = join(rootDir, 'auth.sqlite');
  const videoMetadataDbPath = join(dataDir, 'video-metadata.sqlite');

  await mkdir(join(storageDir, 'uploads', 'thumbnails'), { recursive: true });
  await mkdir(join(dataDir, 'videos'), { recursive: true });
  await mkdir(dataDir, { recursive: true });

  await Promise.all([
    writeFile(join(dataDir, 'pending.json'), JSON.stringify(options.pendingVideos ?? [], null, 2)),
    writeFile(join(dataDir, 'playlist-items.json'), '[]'),
    writeFile(join(dataDir, 'playlists.json'), '[]'),
    writeFile(join(dataDir, 'sessions.json'), '[]'),
  ]);

  await Promise.all(
    REQUIRED_BROWSER_PLAYBACK_FIXTURE_IDS.map(videoId => copyPlaybackFixture({
      targetVideosDir: join(dataDir, 'videos'),
      videoId,
    })),
  );

  await seedLibraryVideoMetadata(videoMetadataDbPath, SEEDED_VIDEOS);

  return {
    authDbPath,
    cleanup: async () => {
      await rm(rootDir, { force: true, recursive: true });
    },
    rootDir,
    storageDir,
    videoMetadataDbPath,
  };
}
