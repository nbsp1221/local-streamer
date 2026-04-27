import { spawn as nodeSpawn } from 'node:child_process';
import type { IngestVideoAnalysisPort } from '~/modules/ingest/application/ports/ingest-video-analysis.port';
import type { IngestMediaAnalysis } from '~/modules/ingest/domain/media-preparation-policy';
import { getFFprobePath } from '~/shared/config/video-tools.server';

export interface SpawnLikeResult {
  kill?(signal?: NodeJS.Signals | number): boolean;
  killed?: boolean;
  on(event: 'close', listener: (code: number | null) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  pid?: number;
  stderr?: NodeJS.ReadableStream;
  stdout?: NodeJS.ReadableStream;
}

type SpawnLike = (command: string, args: string[]) => SpawnLikeResult;

interface FfprobeIngestVideoAnalysisAdapterDependencies {
  ffprobePath?: string;
  spawn?: SpawnLike;
  timeoutMs?: number;
}

export class FfprobeIngestVideoAnalysisAdapter implements IngestVideoAnalysisPort {
  private readonly ffprobePath: string;
  private readonly spawn: SpawnLike;
  private readonly timeoutMs: number;

  constructor(deps: FfprobeIngestVideoAnalysisAdapterDependencies = {}) {
    this.ffprobePath = deps.ffprobePath ?? getFFprobePath();
    this.spawn = deps.spawn ?? nodeSpawn;
    this.timeoutMs = deps.timeoutMs ?? 30_000;
  }

  async analyze(inputPath: string): Promise<IngestMediaAnalysis> {
    return new Promise((resolve, reject) => {
      const childProcess = this.spawn(this.ffprobePath, [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        inputPath,
      ]);
      const stdoutPromise = collectStreamOutput(childProcess.stdout);
      const stderrPromise = collectStreamOutput(childProcess.stderr);
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        terminateProcess(childProcess);
        reject(new Error(`ffprobe timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      childProcess.on('close', async (code) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

        if (code !== 0) {
          reject(new Error(`ffprobe failed with code ${code}: ${stderr.trim()}`));
          return;
        }

        try {
          resolve(parseFfprobeOutput(stdout));
        }
        catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error instanceof Error ? error.message : String(error)}`));
        }
      });

      childProcess.on('error', (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        reject(new Error(`ffprobe process error: ${error.message}`));
      });
    });
  }
}

function terminateProcess(childProcess: SpawnLikeResult) {
  if (childProcess.killed || !childProcess.pid || !childProcess.kill) {
    return;
  }

  try {
    childProcess.kill('SIGTERM');
    setTimeout(() => {
      if (!childProcess.killed) {
        childProcess.kill?.('SIGKILL');
      }
    }, 3000);
  }
  catch {
    // Ignore process cleanup errors.
  }
}

function parseFfprobeOutput(stdout: string): IngestMediaAnalysis {
  const parsed = JSON.parse(stdout) as {
    format?: {
      duration?: string;
      format_name?: string;
    };
    streams?: Array<{
      codec_name?: string;
      codec_type?: string;
      height?: number;
      index?: number;
      width?: number;
    }>;
  };
  const duration = Number.parseFloat(parsed.format?.duration ?? '0');

  if (!Number.isFinite(duration)) {
    throw new Error('duration is not finite');
  }

  const primaryVideo = parsed.streams?.find(stream => stream.codec_type === 'video');
  const primaryAudio = parsed.streams?.find(stream => stream.codec_type === 'audio');
  const analysis: IngestMediaAnalysis = {
    duration,
  };

  if (parsed.format?.format_name) {
    analysis.containerFormat = parsed.format.format_name;
  }

  if (primaryVideo) {
    analysis.primaryVideo = {
      codecName: primaryVideo.codec_name,
      height: primaryVideo.height,
      streamIndex: typeof primaryVideo.index === 'number' ? primaryVideo.index : 0,
      width: primaryVideo.width,
    };
  }

  if (primaryAudio) {
    analysis.primaryAudio = {
      codecName: primaryAudio.codec_name,
      streamIndex: typeof primaryAudio.index === 'number' ? primaryAudio.index : 0,
    };
  }

  return analysis;
}

function collectStreamOutput(stream?: NodeJS.ReadableStream) {
  if (!stream) {
    return Promise.resolve('');
  }

  return new Promise<string>((resolve, reject) => {
    let output = '';

    stream.on('data', (chunk) => {
      output += chunk.toString();
    });
    stream.on('end', () => resolve(output));
    stream.on('error', reject);
  });
}
