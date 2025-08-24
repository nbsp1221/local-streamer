/**
 * FFmpeg Process Manager
 *
 * Manages FFmpeg process execution with queue-based concurrency control.
 * This is the integration layer between existing FFmpeg spawn code and the VideoProcessingQueue.
 *
 * SOLID Principles:
 * - Single Responsibility: Only manages FFmpeg process execution
 * - Dependency Inversion: Accepts queue as dependency, not tightly coupled
 * - Interface Segregation: Minimal interface for process execution
 */

import { type ChildProcess, spawn } from 'child_process';
import { type ProcessingTask, videoProcessingQueue } from './video-processing-queue';

export interface FFmpegProcessOptions {
  command: string;
  args: string[];
  onStdout?: (data: Buffer) => void;
  onStderr?: (data: Buffer) => void;
  onProgress?: (data: Buffer) => void; // For FFmpeg progress parsing
}

export interface FFmpegProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Execute FFmpeg command through the processing queue
 *
 * This function wraps the existing FFmpeg spawn pattern but adds:
 * - Concurrency control via queue
 * - Consistent error handling
 * - Process cleanup
 * - Progress monitoring
 */
export async function executeFFmpegCommand(options: FFmpegProcessOptions): Promise<FFmpegProcessResult> {
  const task: ProcessingTask<FFmpegProcessResult> = () => {
    return new Promise((resolve, reject) => {
      console.log(`🎬 Executing FFmpeg: ${options.command} ${options.args.join(' ')}`);

      const process: ChildProcess = spawn(options.command, options.args);
      let stdout = '';
      let stderr = '';
      let isCleanedUp = false;

      // Handle stdout
      process.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        if (options.onStdout) {
          options.onStdout(data);
        }
      });

      // Handle stderr (FFmpeg outputs progress to stderr)
      process.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();

        // Call progress callback if provided
        if (options.onProgress) {
          options.onProgress(data);
        }

        // Call generic stderr callback if provided
        if (options.onStderr) {
          options.onStderr(data);
        }
      });

      // Graceful cleanup function
      const cleanup = (reason: string = 'cleanup') => {
        if (isCleanedUp || !process || process.killed) {
          return;
        }

        isCleanedUp = true;
        console.log(`🧹 Cleaning up FFmpeg process: ${reason}`);

        // Try graceful termination first (for incomplete files)
        if (process.pid) {
          try {
            process.kill('SIGTERM');

            // If process doesn't exit in 3 seconds, force kill
            setTimeout(() => {
              if (!process.killed) {
                console.warn(`⚠️ FFmpeg process not responding, force killing`);
                process.kill('SIGKILL');
              }
            }, 3000);
          }
          catch (error) {
            console.error(`Failed to terminate FFmpeg process:`, error);
          }
        }
      };

      // Handle process completion
      process.on('close', (code) => {
        if (isCleanedUp) return; // Already handled

        if (code === 0) {
          console.log(`✅ FFmpeg command completed successfully`);
          resolve({
            exitCode: code,
            stdout,
            stderr,
          });
        }
        else {
          console.error(`❌ FFmpeg command failed with exit code ${code}`);
          console.error(`FFmpeg stderr: ${stderr}`);
          reject(new Error(`FFmpeg command failed with exit code ${code}. Error: ${stderr}`));
        }
      });

      // Handle process errors
      process.on('error', (error) => {
        console.error(`❌ FFmpeg process error:`, error);
        cleanup('process error');
        reject(new Error(`FFmpeg process error: ${error.message}`));
      });

      // CRITICAL: Handle queue timeout by cleaning up the process
      // This prevents orphaned FFmpeg processes when queue times out
      const timeoutCleanup = () => cleanup('queue timeout');

      // Return cleanup function so queue can call it on timeout
      (task as any).cleanup = timeoutCleanup;
    });
  };

  try {
    return await videoProcessingQueue.process(task);
  }
  catch (error) {
    // If queue times out, ensure process cleanup
    if ((task as any).cleanup) {
      (task as any).cleanup();
    }
    throw error;
  }
}

/**
 * Convenience function that matches the existing HLSConverter spawn pattern
 * This allows minimal changes to existing code while adding queue protection
 */
export async function spawnFFmpeg(
  command: string,
  args: string[],
  options?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    onProgress?: (data: string) => void;
  },
): Promise<void> {
  await executeFFmpegCommand({
    command,
    args,
    onStdout: options?.onStdout ? data => options.onStdout!(data.toString()) : undefined,
    onStderr: options?.onStderr ? data => options.onStderr!(data.toString()) : undefined,
    onProgress: options?.onProgress ? data => options.onProgress!(data.toString()) : undefined,
  });
}

/**
 * Get current FFmpeg processing status
 */
export function getFFmpegStatus() {
  return {
    queue: videoProcessingQueue.getStatus(),
    message: `${videoProcessingQueue.getStatus().running} FFmpeg processes running, ${videoProcessingQueue.getStatus().waiting} waiting`,
  };
}
