import { spawn } from 'child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { VideoAnalysis } from './video-analysis.types';
import { FFprobeAnalysisService } from './ffprobe-analysis.service';

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

describe('FFprobeAnalysisService', () => {
  let service: FFprobeAnalysisService;
  let mockSpawn: any;

  beforeEach(() => {
    service = new FFprobeAnalysisService();
    mockSpawn = vi.mocked(spawn);
    vi.clearAllMocks();
  });

  describe('analyze', () => {
    it('should analyze video file successfully', async () => {
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
      const analyzePromise = service.analyze('/test/video.mp4');

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

      const result = await analyzePromise;

      expect(result).toEqual({
        duration: 120.5,
        bitrate: 2500, // Converted to kbps
        audioBitrate: 128, // Converted to kbps
        audioCodec: 'aac',
        videoCodec: 'h264',
        fileSize: 50000000,
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

      const analyzePromise = service.analyze('/test/invalid.mp4');

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

      await expect(analyzePromise).rejects.toThrow('ffprobe failed with code 1: Input file not found');
    });

    it('should handle JSON parsing error', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const analyzePromise = service.analyze('/test/video.mp4');

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

      await expect(analyzePromise).rejects.toThrow('Failed to parse ffprobe output');
    });

    it('should handle process error', async () => {
      const mockProcess = {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProcess);

      const analyzePromise = service.analyze('/test/video.mp4');

      // Trigger process error
      const errorCallback = mockProcess.on.mock.calls.find(
        ([event]) => event === 'error',
      )?.[1];
      errorCallback?.(new Error('Process spawn failed'));

      await expect(analyzePromise).rejects.toThrow('ffprobe process error: Error: Process spawn failed');
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

      const analyzePromise = service.analyze('/test/audio-only.mp3');

      const stdoutCallback = mockProcess.stdout.on.mock.calls.find(
        ([event]) => event === 'data',
      )?.[1];
      stdoutCallback?.(JSON.stringify(mockProbeData));

      const closeCallback = mockProcess.on.mock.calls.find(
        ([event]) => event === 'close',
      )?.[1];
      closeCallback?.(0);

      const result = await analyzePromise;

      expect(result).toEqual({
        duration: 60.0,
        bitrate: 1000,
        audioBitrate: 128, // Default value
        audioCodec: 'unknown', // Default value
        videoCodec: 'unknown', // Default value
        fileSize: 10000000,
      });
    });
  });

  describe('calculateOptimalBitrates', () => {
    it('should copy original AAC audio when efficient', () => {
      const analysis: VideoAnalysis = {
        duration: 120,
        bitrate: 2500,
        audioBitrate: 128,
        audioCodec: 'aac',
        videoCodec: 'h264',
        fileSize: 50000000,
      };

      const result = service.calculateOptimalBitrates(analysis, 'cpu-h265');

      expect(result.audioSettings.codec).toBe('copy');
      expect(result.audioSettings.bitrate).toBe('');
      expect(result.targetVideoBitrate).toBe(2322); // 2500 - 128 - 50
    });

    it('should re-encode non-AAC audio', () => {
      const analysis: VideoAnalysis = {
        duration: 120,
        bitrate: 3000,
        audioBitrate: 320,
        audioCodec: 'mp3',
        videoCodec: 'h264',
        fileSize: 60000000,
      };

      const result = service.calculateOptimalBitrates(analysis, 'cpu-h265');

      expect(result.audioSettings.codec).toBe('aac');
      expect(result.audioSettings.bitrate).toBe('128k'); // Min(128, 320*0.8) = 128
      expect(result.targetVideoBitrate).toBe(2822); // 3000 - 128 - 50
    });

    it('should re-encode high-bitrate AAC audio', () => {
      const analysis: VideoAnalysis = {
        duration: 120,
        bitrate: 4000,
        audioBitrate: 256,
        audioCodec: 'aac',
        videoCodec: 'h264',
        fileSize: 80000000,
      };

      const result = service.calculateOptimalBitrates(analysis, 'cpu-h265');

      expect(result.audioSettings.codec).toBe('aac');
      expect(result.audioSettings.bitrate).toBe('128k'); // Min(128, 256*0.8) = 128
      expect(result.targetVideoBitrate).toBe(3822); // 4000 - 128 - 50
    });

    it('should enforce minimum video bitrate', () => {
      const analysis: VideoAnalysis = {
        duration: 120,
        bitrate: 200, // Very low bitrate
        audioBitrate: 128,
        audioCodec: 'aac',
        videoCodec: 'h264',
        fileSize: 5000000,
      };

      const result = service.calculateOptimalBitrates(analysis, 'cpu-h265');

      expect(result.targetVideoBitrate).toBe(500); // Minimum enforced
    });

    it('should handle edge case with zero bitrate', () => {
      const analysis: VideoAnalysis = {
        duration: 120,
        bitrate: 0,
        audioBitrate: 0,
        audioCodec: 'unknown',
        videoCodec: 'h264',
        fileSize: 1000000,
      };

      const result = service.calculateOptimalBitrates(analysis, 'cpu-h265');

      expect(result.targetVideoBitrate).toBe(500); // Minimum enforced
      expect(result.audioSettings.codec).toBe('aac');
    });
  });
});
