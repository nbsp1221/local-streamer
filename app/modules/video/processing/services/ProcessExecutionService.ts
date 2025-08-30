import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import {
  type ProcessExecutionOptions,
  type ProcessExecutionResult,
  type ProcessExecutionService,
  type ProcessProgress,
  ProcessExecutionError,
  ProcessTimeoutError,
} from '../types/process-execution.types';

/**
 * Service responsible for executing external processes with proper error handling,
 * timeout support, and progress tracking.
 */
export class ProcessExecutionServiceImpl implements ProcessExecutionService {
  private runningProcesses: Map<string, ChildProcess> = new Map();

  /**
   * Execute a process and wait for completion
   */
  async execute(options: ProcessExecutionOptions): Promise<ProcessExecutionResult> {
    const startTime = Date.now();
    const { command, args, cwd, env, timeout, captureStdout, captureStderr, label } = options;

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let timeoutHandle: NodeJS.Timeout | undefined;

      console.log(`🔧 [ProcessExecution] Running: ${command} ${args.join(' ')}`);
      if (label) {
        console.log(`🏷️  [ProcessExecution] Label: ${label}`);
      }

      // Spawn the process
      const childProcess = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
      });

      // Track the process if it has a label
      if (label) {
        this.runningProcesses.set(label, childProcess);
      }

      // Set up timeout if specified
      if (timeout) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          childProcess.kill('SIGKILL');
          const duration = Date.now() - startTime;
          reject(new ProcessTimeoutError(
            `Process timed out after ${timeout}ms: ${command}`,
            command,
            timeout,
          ));
        }, timeout);
      }

      // Capture stdout if requested
      if (captureStdout && childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      // Capture stderr if requested
      if (captureStderr && childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      // Handle process completion
      childProcess.on('close', (code) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        if (label) {
          this.runningProcesses.delete(label);
        }

        const duration = Date.now() - startTime;
        const exitCode = code || 0;

        console.log(`✅ [ProcessExecution] Completed in ${duration}ms with exit code ${exitCode}`);

        if (!timedOut) {
          if (exitCode === 0) {
            resolve({
              exitCode,
              stdout: captureStdout ? stdout : undefined,
              stderr: captureStderr ? stderr : undefined,
              duration,
              timedOut: false,
            });
          }
          else {
            reject(new ProcessExecutionError(
              `Process failed with exit code ${exitCode}: ${command}`,
              exitCode,
              stderr,
              command,
            ));
          }
        }
      });

      // Handle process errors
      childProcess.on('error', (error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        if (label) {
          this.runningProcesses.delete(label);
        }

        console.error(`❌ [ProcessExecution] Process error:`, error);
        reject(error);
      });
    });
  }

  /**
   * Execute a process with streaming output and progress tracking
   */
  async executeWithStreaming(options: ProcessExecutionOptions): Promise<ProcessExecutionResult> {
    const startTime = Date.now();
    const {
      command,
      args,
      cwd,
      env,
      timeout,
      captureStdout,
      captureStderr,
      onProgress,
      label,
      videoDurationSec,
    } = options;

    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      let timeoutHandle: NodeJS.Timeout | undefined;

      console.log(`🔧 [ProcessExecution] Streaming: ${command} ${args.join(' ')}`);

      const childProcess = spawn(command, args, {
        cwd,
        env: { ...process.env, ...env },
      });

      if (label) {
        this.runningProcesses.set(label, childProcess);
      }

      if (timeout) {
        timeoutHandle = setTimeout(() => {
          timedOut = true;
          childProcess.kill('SIGKILL');
          reject(new ProcessTimeoutError(
            `Process timed out after ${timeout}ms: ${command}`,
            command,
            timeout,
          ));
        }, timeout);
      }

      // Handle stdout with progress parsing
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (data) => {
          const dataStr = data.toString();

          if (captureStdout) {
            stdout += dataStr;
          }

          // Parse progress if callback provided
          if (onProgress) {
            const progress = this.parseProgress(dataStr);
            if (progress) {
              onProgress(progress);
            }
          }

          // Log output lines for debugging
          dataStr.split('\n').forEach((line: string) => {
            if (line.trim()) {
              console.log(`📝 [${label || command}] ${line}`);
            }
          });
        });
      }

      // Handle stderr with progress parsing (FFmpeg outputs progress to stderr)
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (data) => {
          const dataStr = data.toString();

          if (captureStderr) {
            stderr += dataStr;
          }

          // FFmpeg sends progress to stderr
          if (onProgress && command.includes('ffmpeg')) {
            const progress = this.parseFFmpegProgress(dataStr, videoDurationSec);
            if (progress) {
              onProgress(progress);
            }
          }
        });
      }

      childProcess.on('close', (code) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        if (label) {
          this.runningProcesses.delete(label);
        }

        const duration = Date.now() - startTime;
        const exitCode = code || 0;

        console.log(`✅ [ProcessExecution] Stream completed in ${duration}ms with exit code ${exitCode}`);

        if (!timedOut) {
          if (exitCode === 0) {
            resolve({
              exitCode,
              stdout: captureStdout ? stdout : undefined,
              stderr: captureStderr ? stderr : undefined,
              duration,
              timedOut: false,
            });
          }
          else {
            reject(new ProcessExecutionError(
              `Process failed with exit code ${exitCode}: ${command}`,
              exitCode,
              stderr,
              command,
            ));
          }
        }
      });

      childProcess.on('error', (error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }

        if (label) {
          this.runningProcesses.delete(label);
        }

        reject(error);
      });
    });
  }

  /**
   * Kill a running process by its label
   */
  async killByLabel(label: string): Promise<void> {
    const process = this.runningProcesses.get(label);
    if (process) {
      console.log(`🛑 [ProcessExecution] Killing process with label: ${label}`);
      process.kill('SIGKILL');
      this.runningProcesses.delete(label);
    }
  }

  /**
   * Check if a command is available in the system
   */
  async isCommandAvailable(command: string): Promise<boolean> {
    try {
      await this.execute({
        command: 'which',
        args: [command],
        captureStdout: true,
      });
      return true;
    }
    catch {
      return false;
    }
  }

  /**
   * Parse generic progress output
   */
  private parseProgress(output: string): ProcessProgress | null {
    // This is a simple implementation that can be extended
    // for specific tools like FFmpeg, ImageMagick, etc.

    const lines = output.split('\n');
    for (const line of lines) {
      // Look for percentage patterns like "50%", "[50%]", "Progress: 50%"
      const percentMatch = line.match(/(\d+(?:\.\d+)?)\s*%/);
      if (percentMatch) {
        return {
          percentage: parseFloat(percentMatch[1]),
          raw: line.trim(),
        };
      }
    }

    return null;
  }

  /**
   * Parse FFmpeg-specific progress output with enhanced progress calculation
   */
  private parseFFmpegProgress(output: string, totalDurationSec?: number): ProcessProgress | null {
    // FFmpeg progress format: frame=  123 fps= 45.6 q=28.0 size=    1024kB time=00:00:05.12 bitrate= 1638.4kbits/s speed=2.34x
    const frameMatch = output.match(/frame=\s*(\d+)/);
    const fpsMatch = output.match(/fps=\s*([\d.]+)/);
    const timeMatch = output.match(/time=\s*(\d{2}:\d{2}:\d{2}\.\d{2})/);
    const speedMatch = output.match(/speed=\s*([\d.]+)x/);

    if (frameMatch || timeMatch || speedMatch) {
      const result: ProcessProgress = {
        frame: frameMatch ? parseInt(frameMatch[1]) : undefined,
        speed: speedMatch ? `${speedMatch[1]}x` : undefined,
        raw: output.trim(),
      };

      // Enhanced progress calculation with total duration
      if (timeMatch && totalDurationSec && totalDurationSec > 0) {
        const currentTimeSec = this.parseTimeToSeconds(timeMatch[1]);
        const percentage = Math.min(100, Math.max(0, (currentTimeSec / totalDurationSec) * 100));
        const speed = speedMatch ? parseFloat(speedMatch[1]) : 1.0;

        result.percentage = percentage;

        // Calculate ETA based on remaining time and current speed
        if (speed > 0 && percentage < 100) {
          const remainingTimeSec = totalDurationSec - currentTimeSec;
          const etaSeconds = remainingTimeSec / speed;
          result.eta = this.formatDuration(etaSeconds);
        }
      }

      return result;
    }

    return null;
  }

  /**
   * Parse FFmpeg time format (HH:MM:SS.MS) to total seconds
   */
  private parseTimeToSeconds(timeStr: string): number {
    const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (!match) return 0;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = parseInt(match[3], 10);
    const milliseconds = parseInt(match[4], 10);

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 100;
  }

  /**
   * Format seconds to readable duration (MM:SS or HH:MM:SS)
   */
  private formatDuration(totalSeconds: number): string {
    if (totalSeconds <= 0) return '00:00';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    else {
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }
}

// Export singleton instance
export const processExecutionService = new ProcessExecutionServiceImpl();
