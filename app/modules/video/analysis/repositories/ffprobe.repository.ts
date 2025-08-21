import { spawn } from 'child_process';
import { config } from '~/configs';
import type { VideoAnalysisRepository, VideoMetadata } from './video-analysis-repository.types';

export class FFprobeRepository implements VideoAnalysisRepository {
  async getVideoMetadata(filePath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const ffprobeArgs = [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
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
}
