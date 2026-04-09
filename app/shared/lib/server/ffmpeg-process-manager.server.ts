import { spawn as nodeSpawn } from 'node:child_process';
import { getFFmpegPath } from '~/shared/config/video-tools.server';
import { type ProcessingTask, videoProcessingQueue, VideoProcessingQueue } from './video-processing-queue.server';

interface ChildProcessStreamLike {
  on(event: 'data', listener: (data: Buffer) => void): void;
}

interface ChildProcessLike {
  killed: boolean;
  kill(signal?: NodeJS.Signals | number): boolean;
  on(event: 'close' | 'error', listener: (value: unknown) => void): void;
  pid?: number;
  stderr?: ChildProcessStreamLike | null;
  stdout?: ChildProcessStreamLike | null;
}

type SpawnLike = (command: string, args: string[]) => ChildProcessLike;

export interface FFmpegProcessOptions {
  args: string[];
  command: string;
  onProgress?: (data: Buffer) => void;
  onStderr?: (data: Buffer) => void;
  onStdout?: (data: Buffer) => void;
  queue?: VideoProcessingQueue;
  spawn?: SpawnLike;
  timeoutMs?: number;
}

export interface FFmpegProcessResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

function resolveCommand(command: string) {
  return command === 'ffmpeg' ? getFFmpegPath() : command;
}

export async function executeFFmpegCommand(options: FFmpegProcessOptions): Promise<FFmpegProcessResult> {
  const queue = options.queue ?? (
    options.timeoutMs === undefined
      ? videoProcessingQueue
      : new VideoProcessingQueue({ timeout: options.timeoutMs })
  );
  const spawnImpl: SpawnLike = options.spawn ?? ((command, args) => nodeSpawn(command, args) as unknown as ChildProcessLike);
  const task = (() => new Promise<FFmpegProcessResult>((resolve, reject) => {
    const childProcess = spawnImpl(resolveCommand(options.command), options.args);
    let isCleanedUp = false;
    let stderr = '';
    let stdout = '';

    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
      options.onStdout?.(data);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      options.onProgress?.(data);
      options.onStderr?.(data);
    });

    const cleanup = () => {
      if (isCleanedUp || childProcess.killed) {
        return;
      }

      isCleanedUp = true;

      if (childProcess.pid) {
        try {
          childProcess.kill('SIGTERM');
          setTimeout(() => {
            if (!childProcess.killed) {
              childProcess.kill('SIGKILL');
            }
          }, 3000);
        }
        catch {
          // Ignore cleanup errors.
        }
      }
    };

    childProcess.on('close', (code) => {
      if (isCleanedUp) {
        return;
      }

      if (code === 0) {
        resolve({
          exitCode: code as number,
          stderr,
          stdout,
        });
        return;
      }

      reject(new Error(`FFmpeg command failed with exit code ${code}. Error: ${stderr}`));
    });

    childProcess.on('error', (error) => {
      cleanup();
      reject(new Error(`FFmpeg process error: ${error instanceof Error ? error.message : String(error)}`));
    });

    task.cleanup = cleanup;
  })) as ProcessingTask<FFmpegProcessResult>;

  try {
    return await queue.process(task);
  }
  catch (error) {
    task.cleanup?.();
    throw error;
  }
}

export async function spawnFFmpeg(
  command: string,
  args: string[],
  options?: {
    onProgress?: (data: string) => void;
    onStderr?: (data: string) => void;
    onStdout?: (data: string) => void;
  },
) {
  await executeFFmpegCommand({
    args,
    command,
    onProgress: options?.onProgress ? data => options.onProgress!(data.toString()) : undefined,
    onStderr: options?.onStderr ? data => options.onStderr!(data.toString()) : undefined,
    onStdout: options?.onStdout ? data => options.onStdout!(data.toString()) : undefined,
  });
}
