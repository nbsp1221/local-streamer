import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, test, vi } from 'vitest';

class MockChildProcess extends EventEmitter {
  stdout?: Readable;
  stderr?: Readable;
}

function createSuccessfulProcess(stdout: string) {
  const process = new MockChildProcess();
  process.stdout = Readable.from([stdout]);
  process.stderr = Readable.from([]);
  queueMicrotask(() => process.emit('close', 0));
  return process;
}

function createFailedProcess(stderr: string, code = 1) {
  const process = new MockChildProcess();
  process.stdout = Readable.from([]);
  process.stderr = Readable.from([stderr]);
  queueMicrotask(() => process.emit('close', code));
  return process;
}

describe('FfprobeIngestVideoAnalysisAdapter', () => {
  test('uses ffprobe to return the analyzed duration', async () => {
    const spawn = vi.fn(() => createSuccessfulProcess(JSON.stringify({
      format: {
        duration: '120.25',
      },
      streams: [],
    })));

    const { FfprobeIngestVideoAnalysisAdapter } = await import('../../../../app/modules/ingest/infrastructure/analysis/ffprobe-ingest-video-analysis.adapter');
    const adapter = new FfprobeIngestVideoAnalysisAdapter({
      ffprobePath: '/custom/ffprobe',
      spawn,
    });

    await expect(adapter.analyze('/workspace/video.mp4')).resolves.toEqual({
      duration: 120.25,
    });
    expect(spawn).toHaveBeenCalledWith('/custom/ffprobe', [
      '-v',
      'error',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      '/workspace/video.mp4',
    ]);
  });

  test('throws a readable error when ffprobe exits non-zero', async () => {
    const spawn = vi.fn(() => createFailedProcess('input file missing'));

    const { FfprobeIngestVideoAnalysisAdapter } = await import('../../../../app/modules/ingest/infrastructure/analysis/ffprobe-ingest-video-analysis.adapter');
    const adapter = new FfprobeIngestVideoAnalysisAdapter({
      ffprobePath: '/custom/ffprobe',
      spawn,
    });

    await expect(adapter.analyze('/workspace/video.mp4')).rejects.toThrow(
      'ffprobe failed with code 1: input file missing',
    );
  });

  test('throws a readable error when ffprobe returns invalid JSON', async () => {
    const spawn = vi.fn(() => createSuccessfulProcess('not-json'));

    const { FfprobeIngestVideoAnalysisAdapter } = await import('../../../../app/modules/ingest/infrastructure/analysis/ffprobe-ingest-video-analysis.adapter');
    const adapter = new FfprobeIngestVideoAnalysisAdapter({
      ffprobePath: '/custom/ffprobe',
      spawn,
    });

    await expect(adapter.analyze('/workspace/video.mp4')).rejects.toThrow(
      'Failed to parse ffprobe output',
    );
  });
});
