import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';

describe('FfmpegVideoTranscoderAdapter', () => {
  let rootDir = '';

  afterEach(async () => {
    vi.resetModules();

    if (rootDir) {
      await rm(rootDir, { force: true, recursive: true });
      rootDir = '';
    }
  });

  test('packages a prepared ingest video into the active workspace using active-owned helpers', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-ingest-transcoder-'));
    const videoId = 'video-123';
    const videoDir = path.join(rootDir, videoId);
    const sourcePath = path.join(videoDir, 'video.mp4');
    const manifestPath = path.join(videoDir, 'manifest.mpd');
    const videoSegmentDir = path.join(videoDir, 'video');
    const audioSegmentDir = path.join(videoDir, 'audio');
    const commandCalls: Array<{ args: string[]; command: string }> = [];

    await mkdir(videoDir, { recursive: true });
    await writeFile(sourcePath, 'source-video');
    await writeFile(path.join(videoDir, 'thumbnail.jpg'), 'thumbnail');

    const executeCommand = vi.fn(async (input: { args: string[]; command: string }) => {
      commandCalls.push(input);

      if (input.command === 'ffmpeg') {
        const outputPath = input.args.at(-1);
        if (!outputPath) {
          throw new Error('missing ffmpeg output path');
        }

        await writeFile(outputPath, 'intermediate-video');
        return {
          exitCode: 0,
          stderr: '',
          stdout: '',
        };
      }

      await mkdir(videoSegmentDir, { recursive: true });
      await mkdir(audioSegmentDir, { recursive: true });
      await writeFile(path.join(videoSegmentDir, 'init.mp4'), 'video-init');
      await writeFile(path.join(videoSegmentDir, 'segment-0001.m4s'), 'video-segment');
      await writeFile(path.join(audioSegmentDir, 'init.mp4'), 'audio-init');
      await writeFile(path.join(audioSegmentDir, 'segment-0001.m4s'), 'audio-segment');
      await writeFile(
        manifestPath,
        '<ContentProtection schemeIdUri="urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b"></ContentProtection>',
      );

      return {
        exitCode: 0,
        stderr: '',
        stdout: '',
      };
    });
    const analyze = vi.fn(async () => ({ duration: 120 }));
    const { FfmpegVideoTranscoderAdapter } = await import('../../../../app/modules/ingest/infrastructure/processing/ffmpeg-video-transcoder.adapter');
    const adapter = new FfmpegVideoTranscoderAdapter({
      executeCommand,
      getShakaPackagerPath: () => 'packager',
      videoAnalysis: {
        analyze,
      },
    });

    await expect(adapter.transcode({
      codecFamily: 'h264',
      quality: 'high',
      sourcePath,
      useGpu: false,
      videoId,
    })).resolves.toEqual({
      data: {
        duration: 120,
        manifestPath,
        thumbnailPath: path.join(videoDir, 'thumbnail.jpg'),
        videoId,
      },
      success: true,
    });

    expect(analyze).toHaveBeenCalledWith(sourcePath);
    expect(commandCalls).toHaveLength(2);
    expect(commandCalls[0]).toMatchObject({
      command: 'ffmpeg',
    });
    expect(commandCalls[1]).toMatchObject({
      command: 'packager',
    });
    await expect(readFile(path.join(videoDir, 'key.bin'))).resolves.toHaveLength(16);
    await expect(readFile(manifestPath, 'utf8')).resolves.toContain('value="ClearKey1.0"');
    await expect(stat(path.join(videoDir, 'intermediate.mp4'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  test('generates a fallback thumbnail when the prepared workspace has no preview thumbnail', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-ingest-transcoder-'));
    const videoId = 'video-fallback-thumbnail';
    const videoDir = path.join(rootDir, videoId);
    const sourcePath = path.join(videoDir, 'video.mp4');
    const manifestPath = path.join(videoDir, 'manifest.mpd');
    const videoSegmentDir = path.join(videoDir, 'video');
    const audioSegmentDir = path.join(videoDir, 'audio');
    const commandCalls: Array<{ args: string[]; command: string }> = [];

    await mkdir(videoDir, { recursive: true });
    await writeFile(sourcePath, 'source-video');

    const executeCommand = vi.fn(async (input: { args: string[]; command: string }) => {
      commandCalls.push(input);

      if (input.command === 'ffmpeg' && input.args.includes('-f')) {
        const outputPath = input.args.at(-1);
        if (!outputPath) {
          throw new Error('missing ffmpeg output path');
        }

        await writeFile(outputPath, 'intermediate-video');
        return {
          exitCode: 0,
          stderr: '',
          stdout: '',
        };
      }

      if (input.command === 'ffmpeg') {
        const thumbnailPath = input.args.at(-1);
        if (!thumbnailPath) {
          throw new Error('missing thumbnail output path');
        }

        await writeFile(thumbnailPath, 'generated-thumbnail');
        return {
          exitCode: 0,
          stderr: '',
          stdout: '',
        };
      }

      await mkdir(videoSegmentDir, { recursive: true });
      await mkdir(audioSegmentDir, { recursive: true });
      await writeFile(path.join(videoSegmentDir, 'init.mp4'), 'video-init');
      await writeFile(path.join(videoSegmentDir, 'segment-0001.m4s'), 'video-segment');
      await writeFile(path.join(audioSegmentDir, 'init.mp4'), 'audio-init');
      await writeFile(path.join(audioSegmentDir, 'segment-0001.m4s'), 'audio-segment');
      await writeFile(
        manifestPath,
        '<ContentProtection schemeIdUri="urn:uuid:1077efec-c0b2-4d02-ace3-3c1e52e2fb4b"></ContentProtection>',
      );

      return {
        exitCode: 0,
        stderr: '',
        stdout: '',
      };
    });

    const analyze = vi.fn(async () => ({ duration: 45 }));
    const { FfmpegVideoTranscoderAdapter } = await import('../../../../app/modules/ingest/infrastructure/processing/ffmpeg-video-transcoder.adapter');
    const adapter = new FfmpegVideoTranscoderAdapter({
      executeCommand,
      getShakaPackagerPath: () => 'packager',
      videoAnalysis: {
        analyze,
      },
    });

    await expect(adapter.transcode({
      codecFamily: 'h264',
      quality: 'high',
      sourcePath,
      useGpu: false,
      videoId,
    })).resolves.toEqual({
      data: {
        duration: 45,
        manifestPath,
        thumbnailPath: path.join(videoDir, 'thumbnail.jpg'),
        videoId,
      },
      success: true,
    });

    expect(commandCalls).toHaveLength(3);
    await expect(readFile(path.join(videoDir, 'thumbnail.jpg'), 'utf8')).resolves.toBe('generated-thumbnail');
    await expect(stat(path.join(videoDir, 'intermediate.mp4'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  test('returns a failure result instead of throwing when packaging fails', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-ingest-transcoder-'));
    const videoId = 'video-456';
    const videoDir = path.join(rootDir, videoId);
    const sourcePath = path.join(videoDir, 'video.mp4');
    const executeCommand = vi.fn(async (input: { command: string }) => {
      if (input.command === 'packager') {
        throw new Error('packager missing');
      }

      return {
        exitCode: 0,
        stderr: '',
        stdout: '',
      };
    });
    const analyze = vi.fn(async () => ({ duration: 60 }));

    await mkdir(videoDir, { recursive: true });
    await writeFile(sourcePath, 'source-video');

    const { FfmpegVideoTranscoderAdapter } = await import('../../../../app/modules/ingest/infrastructure/processing/ffmpeg-video-transcoder.adapter');
    const adapter = new FfmpegVideoTranscoderAdapter({
      executeCommand,
      getShakaPackagerPath: () => 'packager',
      videoAnalysis: {
        analyze,
      },
    });

    await expect(adapter.transcode({
      codecFamily: 'h264',
      quality: 'high',
      sourcePath,
      useGpu: false,
      videoId,
    })).resolves.toMatchObject({
      error: expect.objectContaining({
        message: expect.stringContaining('packager missing'),
      }),
      success: false,
    });
  });

  test('returns a failure result when the packager exits without producing required playback artifacts', async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'local-streamer-ingest-transcoder-'));
    const videoId = 'video-missing-artifacts';
    const videoDir = path.join(rootDir, videoId);
    const sourcePath = path.join(videoDir, 'video.mp4');

    await mkdir(videoDir, { recursive: true });
    await writeFile(sourcePath, 'source-video');
    await writeFile(path.join(videoDir, 'thumbnail.jpg'), 'thumbnail');

    const executeCommand = vi.fn(async (input: { args: string[]; command: string }) => {
      if (input.command === 'ffmpeg') {
        const outputPath = input.args.at(-1);
        if (!outputPath) {
          throw new Error('missing ffmpeg output path');
        }

        await writeFile(outputPath, 'intermediate-video');
      }

      return {
        exitCode: 0,
        stderr: '',
        stdout: '',
      };
    });

    const analyze = vi.fn(async () => ({ duration: 30 }));
    const { FfmpegVideoTranscoderAdapter } = await import('../../../../app/modules/ingest/infrastructure/processing/ffmpeg-video-transcoder.adapter');
    const adapter = new FfmpegVideoTranscoderAdapter({
      executeCommand,
      getShakaPackagerPath: () => 'packager',
      videoAnalysis: {
        analyze,
      },
    });

    await expect(adapter.transcode({
      codecFamily: 'h264',
      quality: 'high',
      sourcePath,
      useGpu: false,
      videoId,
    })).resolves.toMatchObject({
      error: expect.objectContaining({
        message: expect.stringContaining('manifest.mpd'),
      }),
      success: false,
    });
  });
});
