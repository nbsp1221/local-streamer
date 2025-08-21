import { spawn } from 'child_process';
import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';
import { config } from '~/configs';
import type { BitrateCalculation, VideoAnalysis, VideoAnalysisService } from './video-analysis.types';

export class FFprobeAnalysisService implements VideoAnalysisService {
  async analyze(inputPath: string): Promise<VideoAnalysis> {
    return new Promise((resolve, reject) => {
      const ffprobeArgs = [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        inputPath,
      ];

      const ffprobeProcess = spawn(config.ffmpeg.ffprobePath, ffprobeArgs);
      let stdout = '';
      let stderr = '';

      ffprobeProcess.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobeProcess.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobeProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
          return;
        }

        try {
          const probeData = JSON.parse(stdout);

          // Extract file size
          const fileSize = parseInt(probeData.format.size || '0', 10);
          const duration = parseFloat(probeData.format.duration || '0');
          const totalBitrate = parseInt(probeData.format.bit_rate || '0', 10) / 1000; // Convert to kbps

          // Find video and audio streams
          const videoStream = probeData.streams.find((s: any) => s.codec_type === 'video');
          const audioStream = probeData.streams.find((s: any) => s.codec_type === 'audio');

          const videoCodec = videoStream?.codec_name || 'unknown';
          const audioCodec = audioStream?.codec_name || 'unknown';
          const audioBitrate = audioStream?.bit_rate ? parseInt(audioStream.bit_rate, 10) / 1000 : 128; // Default to 128kbps

          resolve({
            duration,
            bitrate: totalBitrate,
            audioBitrate,
            audioCodec,
            videoCodec,
            fileSize,
          });
        }
        catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error}`));
        }
      });

      ffprobeProcess.on('error', (error) => {
        reject(new Error(`ffprobe process error: ${error}`));
      });
    });
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
