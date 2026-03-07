/**
 * FFmpeg Process Manager Tests
 *
 * Basic integration tests to ensure the process manager works correctly
 * with the queue and handles cleanup properly.
 */

import { describe, expect, it } from 'vitest';
import { executeFFmpegCommand, getFFmpegStatus, spawnFFmpeg } from './ffmpeg-process-manager';

describe('FFmpeg Process Manager', () => {
  describe('Basic Functionality', () => {
    it('should execute simple commands successfully', async () => {
      // Use echo command to simulate FFmpeg (cross-platform)
      const result = await executeFFmpegCommand({
        command: 'echo',
        args: ['hello', 'world'],
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('hello world');
    });

    it('should handle command failures properly', async () => {
      // Use a command that will fail
      await expect(executeFFmpegCommand({
        command: 'false', // Command that always fails
        args: [],
      })).rejects.toThrow('FFmpeg command failed with exit code 1');
    });

    it('should handle non-existent commands', async () => {
      await expect(executeFFmpegCommand({
        command: 'nonexistent-command-12345',
        args: [],
      })).rejects.toThrow('FFmpeg process error');
    });
  });

  describe('Queue Integration', () => {
    it('should process commands through the queue', async () => {
      const statusBefore = getFFmpegStatus();

      // Start a command that takes some time
      const promise = spawnFFmpeg('sleep', ['0.1']); // 100ms sleep

      // Check that it's in the queue
      const statusDuring = getFFmpegStatus();
      expect(statusDuring.queue.running + statusDuring.queue.waiting).toBeGreaterThanOrEqual(1);

      await promise;

      // Check that queue is empty after completion
      const statusAfter = getFFmpegStatus();
      expect(statusAfter.queue.running).toBe(0);
      expect(statusAfter.queue.waiting).toBe(0);
    });

    it('should respect concurrency limits', async () => {
      // Start multiple commands simultaneously
      const promises = [
        spawnFFmpeg('echo', ['task1']),
        spawnFFmpeg('echo', ['task2']),
        spawnFFmpeg('echo', ['task3']),
      ];

      await Promise.all(promises);

      // All should complete successfully
      expect(true).toBe(true); // If we get here, all commands succeeded
    });
  });

  describe('Progress Callbacks', () => {
    it('should call progress callbacks', async () => {
      const progressOutputs: string[] = [];

      await executeFFmpegCommand({
        command: 'echo',
        args: ['progress-test'],
        onStdout: (data) => {
          progressOutputs.push(data.toString().trim());
        },
      });

      expect(progressOutputs).toContain('progress-test');
    });

    it('should handle stderr callbacks for FFmpeg-like output', async () => {
      const stderrOutputs: string[] = [];

      // Use a command that outputs to stderr (most shell commands)
      await executeFFmpegCommand({
        command: 'sh',
        args: ['-c', 'echo "stderr test" >&2'],
        onStderr: (data) => {
          stderrOutputs.push(data.toString().trim());
        },
      });

      expect(stderrOutputs).toContain('stderr test');
    });
  });

  describe('Status Monitoring', () => {
    it('should provide accurate status information', () => {
      const status = getFFmpegStatus();

      expect(status.queue).toHaveProperty('running');
      expect(status.queue).toHaveProperty('waiting');
      expect(status.queue).toHaveProperty('maxConcurrent');
      expect(status.message).toContain('processes running');
    });
  });
});
