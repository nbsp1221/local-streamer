/**
 * VideoProcessingQueue - FFmpeg Concurrency Control
 *
 * Prevents system crashes by limiting concurrent FFmpeg processes on personal PCs.
 * Implements queue-based resource management for video processing operations.
 *
 * SOLID Principles Applied:
 * - Single Responsibility: Only manages FFmpeg process concurrency
 * - Open/Closed: Extensible for different processing limits
 * - Interface Segregation: Minimal, focused interface
 * - Dependency Inversion: Generic queue, not FFmpeg-specific
 */

export interface ProcessingTask<T> {
  (): Promise<T>;
}

export interface QueueOptions {
  maxConcurrent?: number;
  timeout?: number; // milliseconds
  maxQueueSize?: number;
}

export class VideoProcessingQueue {
  private running = 0;
  private readonly maxConcurrent: number;
  private readonly timeout: number;
  private readonly maxQueueSize: number;
  private processing = false; // Prevent race conditions
  private readonly waitingQueue: Array<{
    task: ProcessingTask<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeoutId?: NodeJS.Timeout;
  }> = [];

  constructor(options: QueueOptions = {}) {
    // Default to 1 concurrent process for personal PC safety
    this.maxConcurrent = options.maxConcurrent ?? 1;
    // Default 10 minute timeout for video processing
    this.timeout = options.timeout ?? 600000;
    // Reasonable queue limit for personal use (not over-engineering)
    this.maxQueueSize = options.maxQueueSize ?? 20;
  }

  /**
   * Add a video processing task to the queue
   *
   * @param task - Function that performs FFmpeg operation
   * @returns Promise that resolves when task completes
   */
  async process<T>(task: ProcessingTask<T>): Promise<T> {
    if (this.waitingQueue.length >= this.maxQueueSize) {
      throw new Error(`Video processing queue is full (max: ${this.maxQueueSize}). Too many videos being processed.`);
    }

    return new Promise<T>((resolve, reject) => {
      this.waitingQueue.push({ task, resolve, reject });
      this.processNext();
    });
  }

  /**
   * Get current queue status for monitoring
   */
  getStatus() {
    return {
      running: this.running,
      waiting: this.waitingQueue.length,
      maxConcurrent: this.maxConcurrent,
      queueFull: this.waitingQueue.length >= this.maxQueueSize,
    };
  }

  /**
   * Process next task in queue if capacity available
   * Fixed: Race condition prevention with processing flag
   */
  private processNext(): void {
    // Prevent concurrent execution of processNext
    if (this.processing) return;
    this.processing = true;

    try {
      // Process all available slots at once
      while (this.running < this.maxConcurrent && this.waitingQueue.length > 0) {
        const queueItem = this.waitingQueue.shift()!;
        this.running++;
        this.executeTask(queueItem);
      }
    }
    finally {
      this.processing = false;
    }
  }

  /**
   * Execute individual task with proper timeout cleanup
   * Fixed: Timer memory leak prevention
   */
  private executeTask(queueItem: {
    task: ProcessingTask<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
    timeoutId?: NodeJS.Timeout;
  }): void {
    // Create timeout with cleanup capability
    const timeoutPromise = new Promise<never>((_, timeoutReject) => {
      queueItem.timeoutId = setTimeout(() => {
        timeoutReject(new Error(`Video processing task timed out after ${this.timeout}ms`));
      }, this.timeout);
    });

    // Race between task completion and timeout
    Promise.race([queueItem.task(), timeoutPromise])
      .then((result) => {
        if (queueItem.timeoutId) {
          clearTimeout(queueItem.timeoutId);
        }
        queueItem.resolve(result);
      })
      .catch((error) => {
        if (queueItem.timeoutId) {
          clearTimeout(queueItem.timeoutId);
        }
        queueItem.reject(error);
      })
      .finally(() => {
        this.running--;
        // Use setImmediate to prevent potential stack overflow in busy scenarios
        setImmediate(() => this.processNext());
      });
  }
}

// Singleton instance for global use
export const videoProcessingQueue = new VideoProcessingQueue();
