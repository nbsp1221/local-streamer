/**
 * VideoProcessingQueue Tests
 *
 * Test suite covering:
 * - Concurrency limits
 * - Queue overflow protection
 * - Timeout handling
 * - Error scenarios
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { type ProcessingTask, VideoProcessingQueue } from './video-processing-queue';

describe('VideoProcessingQueue', () => {
  let queue: VideoProcessingQueue;

  beforeEach(() => {
    queue = new VideoProcessingQueue();
  });

  describe('Concurrency Control', () => {
    it('should limit concurrent tasks to maxConcurrent', async () => {
      const maxConcurrent = 2;
      queue = new VideoProcessingQueue({ maxConcurrent });

      let runningTasks = 0;
      let maxRunning = 0;
      const results: number[] = [];

      const createTask = (id: number): ProcessingTask<number> => async () => {
        runningTasks++;
        maxRunning = Math.max(maxRunning, runningTasks);

        // Simulate async work with actual delay
        await new Promise(resolve => setTimeout(resolve, 50));

        runningTasks--;
        return id;
      };

      // Start 5 tasks simultaneously
      const promises = [1, 2, 3, 4, 5].map(id => queue.process(createTask(id)).then(result => results.push(result)));

      await Promise.all(promises);

      expect(maxRunning).toBe(maxConcurrent);
      expect(results).toHaveLength(5);
      expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('should default to 1 concurrent task', async () => {
      let runningTasks = 0;
      let maxRunning = 0;

      const createTask = (): ProcessingTask<void> => async () => {
        runningTasks++;
        maxRunning = Math.max(maxRunning, runningTasks);

        await new Promise(resolve => setTimeout(resolve, 30));

        runningTasks--;
      };

      const promises = [1, 2, 3].map(() => queue.process(createTask()));

      await Promise.all(promises);

      expect(maxRunning).toBe(1);
    });
  });

  describe('Queue Management', () => {
    it('should process tasks in FIFO order', async () => {
      const results: number[] = [];

      // Add tasks that complete instantly - use Promise.all to ensure order
      const tasks = [1, 2, 3, 4, 5].map(i => queue.process(async () => {
        results.push(i);
        return i;
      }));

      await Promise.all(tasks);
      expect(results).toEqual([1, 2, 3, 4, 5]);
    });

    it('should reject when queue is full', async () => {
      const maxQueueSize = 3;
      queue = new VideoProcessingQueue({
        maxConcurrent: 1,
        maxQueueSize,
      });

      // Fill the queue + 1 running task
      const longTask = () => new Promise(resolve => setTimeout(resolve, 200));

      // Start one long running task
      const runningPromise = queue.process(longTask);

      // Fill the queue to capacity
      const queuedPromises = [];
      for (let i = 0; i < maxQueueSize; i++) {
        queuedPromises.push(queue.process(longTask));
      }

      // This should reject
      await expect(queue.process(longTask)).rejects.toThrow(
        'Video processing queue is full (max: 3)',
      );

      // Cleanup - wait for tasks to complete
      await Promise.all([runningPromise, ...queuedPromises]);
    });

    it('should provide accurate status information', () => {
      const status = queue.getStatus();
      expect(status).toEqual({
        running: 0,
        waiting: 0,
        maxConcurrent: 1,
        queueFull: false,
      });
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout long-running tasks', async () => {
      const timeout = 100; // Short timeout for testing
      queue = new VideoProcessingQueue({ timeout });

      const neverEndingTask: ProcessingTask<never> = () => new Promise(() => {}); // Never resolves

      const promise = queue.process(neverEndingTask);

      await expect(promise).rejects.toThrow(
        'Video processing task timed out after 100ms',
      );
    }, 200); // Test timeout longer than queue timeout

    it('should complete quick tasks without timeout', async () => {
      const timeout = 100;
      queue = new VideoProcessingQueue({ timeout });

      const quickTask: ProcessingTask<string> = async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Much shorter than timeout
        return 'completed';
      };

      const result = await queue.process(quickTask);

      expect(result).toBe('completed');
    });

    it('should handle task errors without timeout interference', async () => {
      const timeout = 100;
      queue = new VideoProcessingQueue({ timeout });

      const errorTask: ProcessingTask<never> = async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Quick failure
        throw new Error('Task failed');
      };

      await expect(queue.process(errorTask)).rejects.toThrow('Task failed');
    });
  });

  describe('Error Handling', () => {
    it('should propagate task errors', async () => {
      const errorMessage = 'Processing failed';
      const failingTask: ProcessingTask<never> = async () => {
        throw new Error(errorMessage);
      };

      await expect(queue.process(failingTask)).rejects.toThrow(errorMessage);
    });

    it('should continue processing after task failure', async () => {
      const results: string[] = [];

      const successTask = (id: string): ProcessingTask<string> => async () => {
        results.push(id);
        return id;
      };

      const failTask: ProcessingTask<never> = async () => {
        throw new Error('Failed');
      };

      // Mix successful and failing tasks
      const promises = [
        queue.process(successTask('task1')).catch(() => 'caught1'),
        queue.process(failTask).catch(() => 'caught2'),
        queue.process(successTask('task3')).catch(() => 'caught3'),
      ];

      const outcomes = await Promise.all(promises);

      expect(results).toContain('task1');
      expect(results).toContain('task3');
      expect(outcomes).toContain('caught2'); // Failed task was caught
    });
  });

  describe('Race Condition Prevention', () => {
    it('should handle rapid task additions without exceeding concurrency', async () => {
      const maxConcurrent = 2;
      queue = new VideoProcessingQueue({ maxConcurrent });

      let runningTasks = 0;
      let maxRunning = 0;

      const task: ProcessingTask<void> = async () => {
        runningTasks++;
        maxRunning = Math.max(maxRunning, runningTasks);

        // Very short task to stress test the queue
        await new Promise(resolve => setTimeout(resolve, 10));

        runningTasks--;
      };

      // Rapidly add many tasks
      const promises = Array.from({ length: 20 }, () => queue.process(task));

      await Promise.all(promises);

      expect(maxRunning).toBe(maxConcurrent);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle realistic FFmpeg-like workload', async () => {
      queue = new VideoProcessingQueue({
        maxConcurrent: 1,
        timeout: 2000, // Reasonable timeout for test
        maxQueueSize: 5,
      });

      const processingTimes = [20, 40, 30, 50, 10]; // Simulated FFmpeg durations (shorter for testing)
      const results: number[] = [];

      const ffmpegLikeTask = (duration: number, id: number): ProcessingTask<number> => async () => {
        // Simulate FFmpeg processing
        await new Promise(resolve => setTimeout(resolve, duration));
        results.push(id);
        return id;
      };

      const promises = processingTimes.map((duration, index) => queue.process(ffmpegLikeTask(duration, index + 1)));

      await Promise.all(promises);

      expect(results).toEqual([1, 2, 3, 4, 5]); // FIFO order
      expect(queue.getStatus().running).toBe(0);
      expect(queue.getStatus().waiting).toBe(0);
    });
  });
});
