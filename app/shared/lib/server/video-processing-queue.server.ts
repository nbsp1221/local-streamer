export type ProcessingTask<T> = (() => Promise<T>) & {
  cleanup?: () => void;
};

export interface QueueOptions {
  maxConcurrent?: number;
  maxQueueSize?: number;
  timeout?: number;
}

interface QueueItem {
  reject: (error: unknown) => void;
  resolve: (value: unknown) => void;
  task: ProcessingTask<unknown>;
  timeoutId?: NodeJS.Timeout;
}

function clearQueueItemTimeout(queueItem: QueueItem) {
  if (queueItem.timeoutId) {
    clearTimeout(queueItem.timeoutId);
  }
}

export class VideoProcessingQueue {
  private running = 0;
  private readonly maxConcurrent: number;
  private readonly maxQueueSize: number;
  private processing = false;
  private readonly timeout: number;
  private readonly waitingQueue: QueueItem[] = [];

  constructor(options: QueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 1;
    this.timeout = options.timeout ?? 600000;
    this.maxQueueSize = options.maxQueueSize ?? 20;
  }

  async process<T>(task: ProcessingTask<T>): Promise<T> {
    if (this.waitingQueue.length >= this.maxQueueSize) {
      throw new Error(`Video processing queue is full (max: ${this.maxQueueSize}). Too many videos being processed.`);
    }

    return new Promise<T>((resolve, reject) => {
      this.waitingQueue.push({
        reject,
        resolve: value => resolve(value as T),
        task: task as ProcessingTask<unknown>,
      });
      this.processNext();
    });
  }

  private executeTask(queueItem: QueueItem) {
    const timeoutPromise = new Promise<never>((_, timeoutReject) => {
      queueItem.timeoutId = setTimeout(() => {
        timeoutReject(new Error(`Video processing task timed out after ${this.timeout}ms`));
      }, this.timeout);
    });

    Promise.race([queueItem.task(), timeoutPromise])
      .then((result) => {
        clearQueueItemTimeout(queueItem);
        queueItem.resolve(result);
      })
      .catch((error) => {
        clearQueueItemTimeout(queueItem);
        queueItem.reject(error);
      })
      .finally(() => {
        this.running--;
        setImmediate(() => this.processNext());
      });
  }

  private processNext() {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.running < this.maxConcurrent && this.waitingQueue.length > 0) {
        const queueItem = this.waitingQueue.shift();
        if (!queueItem) {
          break;
        }
        this.running++;
        this.executeTask(queueItem);
      }
    }
    finally {
      this.processing = false;
    }
  }
}

export const videoProcessingQueue = new VideoProcessingQueue();
