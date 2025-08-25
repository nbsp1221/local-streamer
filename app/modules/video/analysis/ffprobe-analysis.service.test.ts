import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { VideoAnalysisRepository, VideoMetadata } from './repositories/video-analysis-repository.types';
import type { VideoAnalysis } from './video-analysis.types';
import { FFprobeAnalysisService } from './ffprobe-analysis.service';

describe('FFprobeAnalysisService', () => {
  let service: FFprobeAnalysisService;
  let mockRepository: VideoAnalysisRepository;

  beforeEach(() => {
    mockRepository = {
      getVideoMetadata: vi.fn(),
    };
    service = new FFprobeAnalysisService(mockRepository);
    vi.clearAllMocks();
  });

  describe('analyze', () => {
    it('should analyze video file successfully using repository', async () => {
      const mockMetadata: VideoMetadata = {
        duration: 120.5,
        bitrate: 2500,
        audioBitrate: 128,
        audioCodec: 'aac',
        videoCodec: 'h264',
        fileSize: 50000000,
        width: 1920,
        height: 1080,
        frameRate: 30,
      };

      (mockRepository.getVideoMetadata as any).mockResolvedValue(mockMetadata);

      const result = await service.analyze('/test/video.mp4');

      expect(result).toEqual({
        duration: 120.5,
        bitrate: 2500,
        audioBitrate: 128,
        audioCodec: 'aac',
        videoCodec: 'h264',
        fileSize: 50000000,
        width: 1920,
        height: 1080,
        frameRate: 30,
      });

      expect(mockRepository.getVideoMetadata).toHaveBeenCalledWith('/test/video.mp4');
    });

    it('should handle repository errors', async () => {
      const repositoryError = new Error('Repository failed to get metadata');
      (mockRepository.getVideoMetadata as any).mockRejectedValue(repositoryError);

      await expect(service.analyze('/test/invalid.mp4')).rejects.toThrow('Repository failed to get metadata');

      expect(mockRepository.getVideoMetadata).toHaveBeenCalledWith('/test/invalid.mp4');
    });

    it('should pass through metadata from repository unchanged', async () => {
      const mockMetadata: VideoMetadata = {
        duration: 60.0,
        bitrate: 1000,
        audioBitrate: 128,
        audioCodec: 'unknown',
        videoCodec: 'unknown',
        fileSize: 10000000,
        width: 1280,
        height: 720,
        frameRate: 25,
      };

      (mockRepository.getVideoMetadata as any).mockResolvedValue(mockMetadata);

      const result = await service.analyze('/test/audio-only.mp3');

      expect(result).toEqual({
        duration: 60.0,
        bitrate: 1000,
        audioBitrate: 128,
        audioCodec: 'unknown',
        videoCodec: 'unknown',
        fileSize: 10000000,
        width: 1280,
        height: 720,
        frameRate: 25,
      });

      expect(mockRepository.getVideoMetadata).toHaveBeenCalledWith('/test/audio-only.mp3');
    });

    it('should use default repository when none provided', async () => {
      const defaultService = new FFprobeAnalysisService();

      // This test verifies that the default constructor works
      // The actual functionality is tested in the repository tests
      expect(defaultService).toBeInstanceOf(FFprobeAnalysisService);
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
        width: 1920,
        height: 1080,
        frameRate: 30,
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
        width: 1920,
        height: 1080,
        frameRate: 30,
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
        width: 1920,
        height: 1080,
        frameRate: 30,
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
        width: 1920,
        height: 1080,
        frameRate: 30,
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
        width: 1920,
        height: 1080,
        frameRate: 30,
      };

      const result = service.calculateOptimalBitrates(analysis, 'cpu-h265');

      expect(result.targetVideoBitrate).toBe(500); // Minimum enforced
      expect(result.audioSettings.codec).toBe('aac');
    });
  });
});
