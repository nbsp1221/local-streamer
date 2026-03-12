import { describe, expect, it, vi } from 'vitest';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { createCanonicalBackfillPackage } from './create-canonical-backfill-package';

describe('createCanonicalBackfillPackage', () => {
  it('packages into a staging directory while keeping the canonical video ID for ClearKey identity', async () => {
    const stagingDir = await mkdtemp(join(tmpdir(), 'canonical-backfill-'));
    const analyzeSource = vi.fn().mockResolvedValue({
      audioBitrate: 128,
      audioCodec: 'aac',
      bitrate: 4200,
      duration: 12,
      fileSize: 100,
      frameRate: 30,
      height: 1080,
      videoCodec: 'h264',
      width: 1920,
    });
    const transcodeIntermediate = vi.fn().mockResolvedValue(undefined);
    const deriveEncryptionKey = vi.fn().mockReturnValue(Buffer.from('00112233445566778899aabbccddeeff', 'hex'));
    const packageDash = vi.fn().mockImplementation(async ({ outputDir }: { outputDir: string }) => {
      await mkdir(join(outputDir, 'video'), { recursive: true });
      await mkdir(join(outputDir, 'audio'), { recursive: true });
      await writeFile(join(outputDir, 'manifest.mpd'), '<MPD />');
      await writeFile(join(outputDir, 'video', 'init.mp4'), 'video-init');
      await writeFile(join(outputDir, 'audio', 'init.mp4'), 'audio-init');
      await writeFile(join(outputDir, 'video', 'segment-0001.m4s'), 'video-segment');
      await writeFile(join(outputDir, 'audio', 'segment-0001.m4s'), 'audio-segment');
    });

    await createCanonicalBackfillPackage({
      deps: {
        analyzeSource,
        deriveEncryptionKey,
        packageDash,
        transcodeIntermediate,
      },
      sourcePath: '/library/original/video.mp4',
      stagingDir,
      videoId: '68e5f819-15e8-41ef-90ee-8a96769311b7',
    });

    expect(transcodeIntermediate).toHaveBeenCalledWith(expect.objectContaining({
      outputPath: join(stagingDir, 'intermediate.mp4'),
      videoId: '68e5f819-15e8-41ef-90ee-8a96769311b7',
    }));
    expect(packageDash).toHaveBeenCalledWith(expect.objectContaining({
      encryption: expect.objectContaining({
        keyId: 'c68b501ec073bf44905f057db7a6430c',
      }),
      outputDir: stagingDir,
      videoId: '68e5f819-15e8-41ef-90ee-8a96769311b7',
    }));
    await expect(readFile(join(stagingDir, 'key.bin'))).resolves.toEqual(
      Buffer.from('00112233445566778899aabbccddeeff', 'hex'),
    );

    await rm(stagingDir, { force: true, recursive: true });
  });

  it('fails when packaged DASH output does not contain media segments', async () => {
    const stagingDir = await mkdtemp(join(tmpdir(), 'canonical-backfill-'));
    const analyzeSource = vi.fn().mockResolvedValue({
      audioBitrate: 128,
      audioCodec: 'aac',
      bitrate: 4200,
      duration: 12,
      fileSize: 100,
      frameRate: 30,
      height: 1080,
      videoCodec: 'h264',
      width: 1920,
    });
    const transcodeIntermediate = vi.fn().mockResolvedValue(undefined);
    const deriveEncryptionKey = vi.fn().mockReturnValue(Buffer.from('00112233445566778899aabbccddeeff', 'hex'));
    const packageDash = vi.fn().mockImplementation(async ({ outputDir }: { outputDir: string }) => {
      await mkdir(join(outputDir, 'video'), { recursive: true });
      await mkdir(join(outputDir, 'audio'), { recursive: true });
      await writeFile(join(outputDir, 'manifest.mpd'), '<MPD />');
      await writeFile(join(outputDir, 'video', 'init.mp4'), 'video-init');
      await writeFile(join(outputDir, 'audio', 'init.mp4'), 'audio-init');
    });

    await expect(createCanonicalBackfillPackage({
      deps: {
        analyzeSource,
        deriveEncryptionKey,
        packageDash,
        transcodeIntermediate,
      },
      sourcePath: '/library/original/video.mp4',
      stagingDir,
      videoId: '68e5f819-15e8-41ef-90ee-8a96769311b7',
    })).rejects.toThrow('missing packaged media segments: audio');

    await rm(stagingDir, { force: true, recursive: true });
  });
});
