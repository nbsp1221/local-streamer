import { spawn as nodeSpawn } from 'node:child_process';
import { getFFprobePath } from '~/shared/config/video-tools.server';

export interface SpawnLikeResult {
  on(event: 'close', listener: (code: number | null) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  stderr?: NodeJS.ReadableStream;
  stdout?: NodeJS.ReadableStream;
}

type SpawnLike = (command: string, args: string[]) => SpawnLikeResult;

interface FfprobeIngestVideoAnalysisAdapterDependencies {
  ffprobePath?: string;
  spawn?: SpawnLike;
}

export class FfprobeIngestVideoAnalysisAdapter {
  private readonly ffprobePath: string;
  private readonly spawn: SpawnLike;

  constructor(deps: FfprobeIngestVideoAnalysisAdapterDependencies = {}) {
    this.ffprobePath = deps.ffprobePath ?? getFFprobePath();
    this.spawn = deps.spawn ?? nodeSpawn;
  }

  async analyze(inputPath: string): Promise<{ duration: number }> {
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

      childProcess.on('close', async (code) => {
        const [stdout, stderr] = await Promise.all([stdoutPromise, stderrPromise]);

        if (code !== 0) {
          reject(new Error(`ffprobe failed with code ${code}: ${stderr.trim()}`));
          return;
        }

        try {
          const parsed = JSON.parse(stdout) as {
            format?: {
              duration?: string;
            };
          };
          const duration = Number.parseFloat(parsed.format?.duration ?? '0');

          if (!Number.isFinite(duration)) {
            throw new Error('duration is not finite');
          }

          resolve({ duration });
        }
        catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error instanceof Error ? error.message : String(error)}`));
        }
      });

      childProcess.on('error', (error) => {
        reject(new Error(`ffprobe process error: ${error.message}`));
      });
    });
  }
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
