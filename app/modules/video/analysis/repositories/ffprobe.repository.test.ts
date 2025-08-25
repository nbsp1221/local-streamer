import { spawn } from 'child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FFprobeRepository } from './ffprobe.repository';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock config
vi.mock('~/configs', () => ({
  config: {
    ffmpeg: {
      ffprobePath: '/usr/bin/ffprobe',
    },
  },
}));

describe('FFprobeRepository', () => {
  let repository: FFprobeRepository;
  let mockSpawn: any;

  beforeEach(() => {
    repository = new FFprobeRepository();
    mockSpawn = vi.mocked(spawn);
    vi.clearAllMocks();
  });

  describe('getVideoMetadata', () => {
    it('should get video metadata successfully', async () => {
      const mockProbeData = {
        format: {
          size: '50000000',
          duration: '120.5',
          bit_rate: '2500000', // 2500 kbps
        },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
          },
          {
            codec_type: 'audio',
            codec_name: 'aac',
            bit_rate: '128000', // 128 kbps
          },
        ],
      };

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      // Simulate successful ffprobe execution
      const metadataPromise = repository.getVideoMetadata('/test/video.mp4');

      // Trigger stdout data event
      const stdoutCallback = mockProcess.stdout.on.mock.calls.find(
        ([event]) => event === 'data',
      )?.[1];
      stdoutCallback?.(JSON.stringify(mockProbeData));

      // Trigger close event with success code
      const closeCallback = mockProcess.on.mock.calls.find(
        ([event]) => event === 'close',
      )?.[1];
      closeCallback?.(0);

      const result = await metadataPromise;

      expect(result).toEqual({
        duration: 120.5,
        bitrate: 2500, // Converted to kbps
        audioBitrate: 128, // Converted to kbps
        audioCodec: 'aac',
        videoCodec: 'h264',
        fileSize: 50000000,
        width: 0, // Default when not in mock data
        height: 0, // Default when not in mock data
        frameRate: 0, // Default when not in mock data
      });

      expect(mockSpawn).toHaveBeenCalledWith('/usr/bin/ffprobe', [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        '/test/video.mp4',
      ]);
    });

    it('should handle ffprobe failure', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const metadataPromise = repository.getVideoMetadata('/test/invalid.mp4');

      // Trigger stderr data event
      const stderrCallback = mockProcess.stderr.on.mock.calls.find(
        ([event]) => event === 'data',
      )?.[1];
      stderrCallback?.('Input file not found');

      // Trigger close event with error code
      const closeCallback = mockProcess.on.mock.calls.find(
        ([event]) => event === 'close',
      )?.[1];
      closeCallback?.(1);

      await expect(metadataPromise).rejects.toThrow('ffprobe failed with code 1: Input file not found');
    });

    it('should handle JSON parsing error', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const metadataPromise = repository.getVideoMetadata('/test/video.mp4');

      // Trigger stdout with invalid JSON
      const stdoutCallback = mockProcess.stdout.on.mock.calls.find(
        ([event]) => event === 'data',
      )?.[1];
      stdoutCallback?.('invalid json');

      // Trigger close event with success code
      const closeCallback = mockProcess.on.mock.calls.find(
        ([event]) => event === 'close',
      )?.[1];
      closeCallback?.(0);

      await expect(metadataPromise).rejects.toThrow('Failed to parse ffprobe output');
    });

    it('should handle process error', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const metadataPromise = repository.getVideoMetadata('/test/video.mp4');

      // Trigger process error
      const errorCallback = mockProcess.on.mock.calls.find(
        ([event]) => event === 'error',
      )?.[1];
      errorCallback?.(new Error('Process spawn failed'));

      await expect(metadataPromise).rejects.toThrow('ffprobe process error: Error: Process spawn failed');
    });

    it('should handle missing video or audio streams', async () => {
      const mockProbeData = {
        format: {
          size: '10000000',
          duration: '60.0',
          bit_rate: '1000000',
        },
        streams: [
          // No video or audio streams
        ],
      };

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const metadataPromise = repository.getVideoMetadata('/test/audio-only.mp3');

      const stdoutCallback = mockProcess.stdout.on.mock.calls.find(
        ([event]) => event === 'data',
      )?.[1];
      stdoutCallback?.(JSON.stringify(mockProbeData));

      const closeCallback = mockProcess.on.mock.calls.find(
        ([event]) => event === 'close',
      )?.[1];
      closeCallback?.(0);

      const result = await metadataPromise;

      expect(result).toEqual({
        duration: 60.0,
        bitrate: 1000,
        audioBitrate: 128, // Default value
        audioCodec: 'unknown', // Default value
        videoCodec: 'unknown', // Default value
        fileSize: 10000000,
        width: 0, // Default when stream missing
        height: 0, // Default when stream missing
        frameRate: 0, // Default when stream missing
      });
    });

    it('should handle zero or missing format data', async () => {
      const mockProbeData = {
        format: {
          // Missing size, duration, bit_rate
        },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h264',
          },
        ],
      };

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const metadataPromise = repository.getVideoMetadata('/test/minimal.mp4');

      const stdoutCallback = mockProcess.stdout.on.mock.calls.find(
        ([event]) => event === 'data',
      )?.[1];
      stdoutCallback?.(JSON.stringify(mockProbeData));

      const closeCallback = mockProcess.on.mock.calls.find(
        ([event]) => event === 'close',
      )?.[1];
      closeCallback?.(0);

      const result = await metadataPromise;

      expect(result).toEqual({
        duration: 0, // Default when missing
        bitrate: 0, // Default when missing
        audioBitrate: 128, // Default value
        audioCodec: 'unknown', // Default when stream missing
        videoCodec: 'h264',
        fileSize: 0, // Default when missing
        width: 0, // Default when dimensions missing
        height: 0, // Default when dimensions missing
        frameRate: 0, // Default when frame rate missing
      });
    });

    it('should handle audio stream without bitrate', async () => {
      const mockProbeData = {
        format: {
          size: '30000000',
          duration: '180.0',
          bit_rate: '1500000',
        },
        streams: [
          {
            codec_type: 'video',
            codec_name: 'h265',
          },
          {
            codec_type: 'audio',
            codec_name: 'mp3',
            // Missing bit_rate field
          },
        ],
      };

      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const metadataPromise = repository.getVideoMetadata('/test/no-audio-bitrate.mp4');

      const stdoutCallback = mockProcess.stdout.on.mock.calls.find(
        ([event]) => event === 'data',
      )?.[1];
      stdoutCallback?.(JSON.stringify(mockProbeData));

      const closeCallback = mockProcess.on.mock.calls.find(
        ([event]) => event === 'close',
      )?.[1];
      closeCallback?.(0);

      const result = await metadataPromise;

      expect(result).toEqual({
        duration: 180.0,
        bitrate: 1500,
        audioBitrate: 128, // Default when audio bitrate missing
        audioCodec: 'mp3',
        videoCodec: 'h265',
        fileSize: 30000000,
        width: 0, // Default when dimensions not in test data
        height: 0, // Default when dimensions not in test data
        frameRate: 0, // Default when frame rate not in test data
      });
    });
  });
});
