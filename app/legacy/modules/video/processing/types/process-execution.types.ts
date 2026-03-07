/**
 * Types for process execution service
 */

export interface ProcessExecutionOptions {
  /** Command to execute */
  command: string;
  /** Command arguments */
  args: string[];
  /** Working directory for the process */
  cwd?: string;
  /** Environment variables */
  env?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether to capture stdout */
  captureStdout?: boolean;
  /** Whether to capture stderr */
  captureStderr?: boolean;
  /** Progress callback for long-running processes */
  onProgress?: (progress: ProcessProgress) => void;
  /** Label for logging purposes */
  label?: string;
  /** Video duration in seconds for progress calculation (FFmpeg only) */
  videoDurationSec?: number;
}

export interface ProcessProgress {
  /** Progress percentage (0-100) */
  percentage?: number;
  /** Current frame being processed (for video operations) */
  frame?: number;
  /** Total frames to process */
  totalFrames?: number;
  /** Processing speed */
  speed?: string;
  /** Estimated time remaining */
  eta?: string;
  /** Raw progress line from process */
  raw?: string;
}

export interface ProcessExecutionResult {
  /** Exit code of the process */
  exitCode: number;
  /** Captured stdout if requested */
  stdout?: string;
  /** Captured stderr if requested */
  stderr?: string;
  /** Duration of execution in milliseconds */
  duration: number;
  /** Whether the process was killed due to timeout */
  timedOut: boolean;
}

export class ProcessExecutionError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number,
    public readonly stderr: string,
    public readonly command: string,
  ) {
    super(message);
    this.name = 'ProcessExecutionError';
  }
}

export class ProcessTimeoutError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly timeout: number,
  ) {
    super(message);
    this.name = 'ProcessTimeoutError';
  }
}

export interface ProcessExecutionService {
  /**
   * Execute a process with the given options
   */
  execute(options: ProcessExecutionOptions): Promise<ProcessExecutionResult>;

  /**
   * Execute a process and stream output in real-time
   */
  executeWithStreaming(options: ProcessExecutionOptions): Promise<ProcessExecutionResult>;

  /**
   * Kill a running process by its label
   */
  killByLabel(label: string): Promise<void>;

  /**
   * Check if a command is available in the system
   */
  isCommandAvailable(command: string): Promise<boolean>;
}
