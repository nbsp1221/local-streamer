import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

const ORIGINAL_FFMPEG_PATH = process.env.FFMPEG_PATH;
const ORIGINAL_FFPROBE_PATH = process.env.FFPROBE_PATH;

describe('video tools config', () => {
  let rootDir = '';
  let previousCwd = '';

  afterEach(async () => {
    vi.resetModules();

    if (ORIGINAL_FFMPEG_PATH === undefined) {
      delete process.env.FFMPEG_PATH;
    }
    else {
      process.env.FFMPEG_PATH = ORIGINAL_FFMPEG_PATH;
    }

    if (ORIGINAL_FFPROBE_PATH === undefined) {
      delete process.env.FFPROBE_PATH;
    }
    else {
      process.env.FFPROBE_PATH = ORIGINAL_FFPROBE_PATH;
    }

    if (rootDir) {
      await rm(rootDir, { force: true, recursive: true });
      rootDir = '';
    }

    if (previousCwd) {
      process.chdir(previousCwd);
      previousCwd = '';
    }
  });

  test('ignores a stale FFMPEG_PATH and falls back to system ffmpeg when no local binary exists', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-video-tools-'));
    previousCwd = process.cwd();
    process.chdir(rootDir);
    process.env.FFMPEG_PATH = '/tmp/does-not-exist';
    vi.resetModules();

    const { getFFmpegPath } = await import('../../../app/shared/config/video-tools.server');

    expect(getFFmpegPath()).toBe('ffmpeg');
  });

  test('prefers an existing project-local binaries/ffmpeg over system ffmpeg', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-video-tools-'));
    previousCwd = process.cwd();
    process.chdir(rootDir);

    try {
      await import('node:fs/promises').then(({ mkdir }) => mkdir(path.join(rootDir, 'binaries'), { recursive: true }));
      await writeFile(path.join(rootDir, 'binaries', 'ffmpeg'), '', { mode: 0o755 });
      delete process.env.FFMPEG_PATH;
      vi.resetModules();

      const { getFFmpegPath } = await import('../../../app/shared/config/video-tools.server');

      expect(getFFmpegPath()).toBe(path.join(rootDir, 'binaries', 'ffmpeg'));
    }
    finally {
      process.chdir(previousCwd);
      previousCwd = '';
    }
  });

  test('ignores a stale FFPROBE_PATH and falls back to system ffprobe when no local binary exists', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-video-tools-'));
    previousCwd = process.cwd();
    process.chdir(rootDir);
    process.env.FFPROBE_PATH = '/tmp/does-not-exist';
    vi.resetModules();

    const { getFFprobePath } = await import('../../../app/shared/config/video-tools.server');

    expect(getFFprobePath()).toBe('ffprobe');
  });

  test('prefers an existing project-local binaries/ffprobe over system ffprobe', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-video-tools-'));
    previousCwd = process.cwd();
    process.chdir(rootDir);

    try {
      await import('node:fs/promises').then(({ mkdir }) => mkdir(path.join(rootDir, 'binaries'), { recursive: true }));
      await writeFile(path.join(rootDir, 'binaries', 'ffprobe'), '', { mode: 0o755 });
      delete process.env.FFPROBE_PATH;
      vi.resetModules();

      const { getFFprobePath } = await import('../../../app/shared/config/video-tools.server');

      expect(getFFprobePath()).toBe(path.join(rootDir, 'binaries', 'ffprobe'));
    }
    finally {
      process.chdir(previousCwd);
      previousCwd = '';
    }
  });
});
