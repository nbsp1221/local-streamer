import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';
import type { VideoAnalysisRepository } from './repositories/video-analysis-repository.types';
import type { BitrateCalculation, VideoAnalysis, VideoAnalysisService } from './video-analysis.types';
import { FFprobeRepository } from './repositories/ffprobe.repository';

export class FFprobeAnalysisService implements VideoAnalysisService {
  private repository: VideoAnalysisRepository;

  constructor(repository?: VideoAnalysisRepository) {
    this.repository = repository || new FFprobeRepository();
  }

  async analyze(inputPath: string): Promise<VideoAnalysis> {
    const metadata = await this.repository.getVideoMetadata(inputPath);

    // Return the same structure as VideoAnalysis interface
    return {
      duration: metadata.duration,
      bitrate: metadata.bitrate,
      audioBitrate: metadata.audioBitrate,
      audioCodec: metadata.audioCodec,
      videoCodec: metadata.videoCodec,
      fileSize: metadata.fileSize,
    };
  }

  calculateOptimalBitrates(analysis: VideoAnalysis, encoder: EncodingOptions['encoder']): BitrateCalculation {
    // Use original bitrate as ceiling - don't exceed but same size is acceptable
    const maxTotalBitrate = Math.floor(analysis.bitrate);

    // Smart audio handling
    let audioSettings: { codec: string; bitrate: string };
    let audioBitrateValue: number;

    if (analysis.audioCodec === 'aac' && analysis.audioBitrate <= 160) {
      // Original is already efficient AAC, copy it
      audioSettings = { codec: 'copy', bitrate: '' };
      audioBitrateValue = analysis.audioBitrate;
      console.log(`📧 Copying original AAC audio (${analysis.audioBitrate}kbps)`);
    }
    else {
      // Re-encode audio
      const targetAudioBitrate = Math.min(128, analysis.audioBitrate * 0.8); // Don't exceed 128kbps or 80% of original
      audioSettings = { codec: 'aac', bitrate: `${Math.floor(targetAudioBitrate)}k` };
      audioBitrateValue = targetAudioBitrate;
      console.log(`🔄 Re-encoding audio: ${analysis.audioCodec} ${analysis.audioBitrate}kbps → AAC ${Math.floor(targetAudioBitrate)}kbps`);
    }

    // Calculate target video bitrate (total - audio - overhead)
    const hlsOverheadEstimate = 50; // kbps estimate for HLS segmentation overhead
    const targetVideoBitrate = Math.max(
      500, // Minimum 500kbps for video quality
      Math.floor(maxTotalBitrate - audioBitrateValue - hlsOverheadEstimate),
    );

    console.log(`📊 Bitrate calculation: Original ${analysis.bitrate}k → Max total ${maxTotalBitrate}k (Video: ${targetVideoBitrate}k + Audio: ${audioBitrateValue}k + Overhead: ${hlsOverheadEstimate}k)`);

    return {
      targetVideoBitrate,
      audioSettings,
    };
  }
}
